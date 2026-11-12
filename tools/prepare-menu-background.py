"""Подготовить WebP-фон меню, сохранив разрешение и исходный JPEG.

Запуск: python tools/prepare-menu-background.py. Нужен Pillow с WebP.
Готовый файл хранится в Git, поэтому для сборки сайта Python не нужен.
"""
from pathlib import Path
from io import BytesIO
import json
import math
from PIL import Image, ImageChops, ImageStat, features

root = Path(__file__).resolve().parents[1]
source = root / 'assets/shell/menu-background.jpg'
target = source.with_suffix('.webp')
if not features.check('webp'):
    raise RuntimeError('В установленном Pillow нет поддержки WebP.')
with Image.open(source) as original:
    image = original.convert('RGB')
    options = {'icc_profile': original.info['icc_profile']} if original.info.get('icc_profile') else {}
    buffer = BytesIO()
    image.save(buffer, format='WEBP', quality=92, method=6, **options)
    data = buffer.getvalue()
    with Image.open(BytesIO(data)) as decoded:
        if decoded.size != image.size:
            raise RuntimeError('При перекодировании изменилось разрешение.')
        rms = ImageStat.Stat(ImageChops.difference(image, decoded.convert('RGB'))).rms
        mse = sum(value * value for value in rms) / 3
        psnr = round(10 * math.log10(255 * 255 / mse), 2) if mse else None
    if not target.exists() or target.read_bytes() != data:
        target.write_bytes(data)
    print(json.dumps({'source_bytes': source.stat().st_size, 'webp_bytes': len(data),
        'dimensions': image.size, 'quality': 92, 'psnr_db': psnr}))
