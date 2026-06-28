import gzip
import zlib
import bz2
import lzma

file_path = 'scratch/eas_log.txt'
with open(file_path, 'rb') as f:
    data = f.read()

print("Original data size:", len(data))

# Try raw zlib
try:
    decompressed = zlib.decompress(data)
    print("zlib success! Size:", len(decompressed))
    with open('scratch/eas_log_decompressed.txt', 'wb') as out:
        out.write(decompressed)
except Exception as e:
    print("zlib failed:", e)

# Try zlib with wbits = -15 (raw deflate)
try:
    decompressed = zlib.decompress(data, -15)
    print("zlib raw success! Size:", len(decompressed))
    with open('scratch/eas_log_decompressed.txt', 'wb') as out:
        out.write(decompressed)
except Exception as e:
    print("zlib raw failed:", e)

# Try zlib with wbits = 16 + zlib.MAX_WBITS (gzip)
try:
    decompressed = zlib.decompress(data, 16 + zlib.MAX_WBITS)
    print("zlib gzip success! Size:", len(decompressed))
    with open('scratch/eas_log_decompressed.txt', 'wb') as out:
        out.write(decompressed)
except Exception as e:
    print("zlib gzip failed:", e)

# Try gzip module
try:
    decompressed = gzip.decompress(data)
    print("gzip success! Size:", len(decompressed))
except Exception as e:
    print("gzip failed:", e)

# Try bz2
try:
    decompressed = bz2.decompress(data)
    print("bz2 success! Size:", len(decompressed))
except Exception as e:
    print("bz2 failed:", e)

# Try lzma
try:
    decompressed = lzma.decompress(data)
    print("lzma success! Size:", len(decompressed))
except Exception as e:
    print("lzma failed:", e)
