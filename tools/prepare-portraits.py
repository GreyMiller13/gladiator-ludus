"""Подготовить WebP-портреты. Запуск из корня: python tools/prepare-portraits.py.

Нужен Pillow с поддержкой WebP. JPEG остаются неизменными.
Готовые файлы хранятся в Git, поэтому для сборки сайта Python не нужен.
"""
from pathlib import Path
from io import BytesIO
import json
import math
from PIL import Image, ImageChops, ImageOps, ImageStat, features

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/portraits'
TARGET = SOURCE / 'webp'
SIZES = (512, 1280)
QUALITY = 92


def main():
    if not features.check('webp'):
        raise RuntimeError('В установленном Pillow нет поддержки WebP.')
    sources = sorted(SOURCE.glob('*.jpg'))
    if not sources:
        raise RuntimeError('Исходные JPEG-портреты не найдены.')
    TARGET.mkdir(exist_ok=True)
    totals = {size: 0 for size in SIZES}
    min_psnr = float('inf')
    for source in sources:
        with Image.open(source) as original:
            image = ImageOps.exif_transpose(original).convert('RGB')
            profile = original.info.get('icc_profile')
            for size in SIZES:
                resized = ImageOps.contain(image, (size, size), Image.Resampling.LANCZOS)
                buffer = BytesIO()
                options = {'icc_profile': profile} if profile else {}
                resized.save(buffer, format='WEBP', quality=QUALITY, method=6, **options)
                data = buffer.getvalue()
                with Image.open(BytesIO(data)) as decoded:
                    if decoded.size != resized.size:
                        raise RuntimeError(f'Неверный размер: {source.name}, {size}')
                    rms = ImageStat.Stat(ImageChops.difference(resized, decoded.convert('RGB'))).rms
                    mse = sum(value * value for value in rms) / 3
                    if mse:
                        min_psnr = min(min_psnr, 10 * math.log10(255 * 255 / mse))
                target = TARGET / f'{source.stem}-{size}.webp'
                if not target.exists() or target.read_bytes() != data:
                    target.write_bytes(data)
                totals[size] += len(data)
    print(json.dumps({
        'portraits': len(sources), 'variants': len(sources) * len(SIZES),
        'source_bytes': sum(source.stat().st_size for source in sources),
        'webp_bytes': totals, 'quality': QUALITY,
        'min_psnr_db': round(min_psnr, 2),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
