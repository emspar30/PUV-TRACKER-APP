# Reads the offline map (PMTiles v3 with gzip Mapbox Vector Tiles) for the extract scripts.
# Standard library only; no network.
import gzip
import math
import os
import struct

TILES = os.path.join(os.path.dirname(__file__), '..', 'assets', 'map', 'butuan_v2.pmtiles')

data = open(TILES, 'rb').read()
assert data[:7] == b'PMTiles' and data[7] == 3, 'expected a PMTiles v3 file'
root_off, root_len, _meta_off, _meta_len, leaf_off, _leaf_len, tile_off, _tile_len = struct.unpack_from('<8Q', data, 8)
internal_comp, tile_comp = data[97], data[98]
min_lon, min_lat, max_lon, max_lat = (v / 1e7 for v in struct.unpack_from('<4i', data, 102))


def decompress(raw, kind):
    return gzip.decompress(raw) if kind == 2 else raw


def varint(buf, i):
    shift = result = 0
    while True:
        b = buf[i]
        i += 1
        result |= (b & 0x7F) << shift
        if b < 0x80:
            return result, i
        shift += 7


def read_directory(buf):
    i = 0
    count, i = varint(buf, i)
    ids, last = [], 0
    for _ in range(count):
        step, i = varint(buf, i)
        last += step
        ids.append(last)
    columns = []
    for _ in range(3):
        column = []
        for _ in range(count):
            value, i = varint(buf, i)
            column.append(value)
        columns.append(column)
    runs, lengths, raw_offsets = columns
    offsets = []
    for k in range(count):
        offsets.append(offsets[k - 1] + lengths[k - 1] if raw_offsets[k] == 0 and k > 0 else raw_offsets[k] - 1)
    return list(zip(ids, runs, lengths, offsets))


def tile_id(z, x, y):
    # The PMTiles Hilbert curve order
    base = sum(4 ** t for t in range(z))
    n = 2 ** z
    d, s, tx, ty = 0, n // 2, x, y
    while s > 0:
        rx = 1 if tx & s else 0
        ry = 1 if ty & s else 0
        d += s * s * ((3 * rx) ^ ry)
        if ry == 0:
            if rx == 1:
                tx, ty = n - 1 - tx, n - 1 - ty
            tx, ty = ty, tx
        s //= 2
    return base + d


ROOT_DIR = read_directory(decompress(data[root_off:root_off + root_len], internal_comp))


def get_tile(z, x, y):
    wanted = tile_id(z, x, y)
    entries = ROOT_DIR
    for _ in range(4):
        hit = None
        for entry in entries:
            if entry[0] <= wanted:
                hit = entry
            else:
                break
        if hit is None:
            return None
        first, run, length, offset = hit
        if run == 0:
            entries = read_directory(decompress(data[leaf_off + offset:leaf_off + offset + length], internal_comp))
            continue
        return decompress(data[tile_off + offset:tile_off + offset + length], tile_comp) if wanted < first + run else None
    return None


def fields(buf):
    i = 0
    while i < len(buf):
        key, i = varint(buf, i)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, i = varint(buf, i)
            yield number, value
        elif wire == 2:
            length, i = varint(buf, i)
            yield number, buf[i:i + length]
            i += length
        elif wire == 1:
            yield number, buf[i:i + 8]
            i += 8
        elif wire == 5:
            yield number, buf[i:i + 4]
            i += 4


def packed(buf):
    out, i = [], 0
    while i < len(buf):
        value, i = varint(buf, i)
        out.append(value)
    return out


def tag_value(buf):
    for number, value in fields(buf):
        if number == 1:
            return value.decode()
        if number == 2:
            return struct.unpack('<f', value)[0]
        if number == 3:
            return struct.unpack('<d', value)[0]
        if number in (4, 5):
            return value
        if number == 6:
            return (value >> 1) ^ -(value & 1)
        if number == 7:
            return bool(value)


def geometry_points(geom):
    # Every vertex, as one list per line piece (points: one vertex each)
    x = y = 0
    i = 0
    pieces, current = [], []
    while i < len(geom):
        command, count = geom[i] & 7, geom[i] >> 3
        i += 1
        if command in (1, 2):
            for _ in range(count):
                dx, dy = geom[i], geom[i + 1]
                i += 2
                x += (dx >> 1) ^ -(dx & 1)
                y += (dy >> 1) ^ -(dy & 1)
                if command == 1 and current:
                    pieces.append(current)
                    current = []
                current.append((x, y))
        elif command == 7 and current:
            pieces.append(current)
            current = []
    if current:
        pieces.append(current)
    return pieces


def to_lonlat(z, tx, ty, px, py, extent):
    n = 2 ** z
    lon = (tx + px / extent) / n * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + py / extent) / n))))
    return lon, lat


def tile_xy(lon, lat, z):
    n = 2 ** z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


def metres(a, b):
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * math.cos(lat), a[1] - b[1]) * 111320




def layers(z, tx, ty):
    """Every layer of one tile, as (name, features, extent); each feature as (tags, geometry type, pieces
    of tile pixel coordinates)."""
    tile = get_tile(z, tx, ty)
    if tile is None:
        return
    for number, layer in fields(tile):
        if number != 3:
            continue
        name, features, keys, values, extent = None, [], [], [], 4096
        for lf, lv in fields(layer):
            if lf == 1:
                name = lv.decode()
            elif lf == 2:
                features.append(lv)
            elif lf == 3:
                keys.append(lv.decode())
            elif lf == 4:
                values.append(tag_value(lv))
            elif lf == 5:
                extent = lv
        decoded = []
        for feature in features:
            tags, gtype, geom = {}, 0, []
            for ff, fv in fields(feature):
                if ff == 2:
                    t = packed(fv)
                    tags = {keys[t[k]]: values[t[k + 1]] for k in range(0, len(t), 2)}
                elif ff == 3:
                    gtype = fv
                elif ff == 4:
                    geom = packed(fv)
            decoded.append((tags, gtype, geometry_points(geom)))
        yield name, decoded, extent
