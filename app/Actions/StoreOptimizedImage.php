<?php

namespace App\Actions;

use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StoreOptimizedImage
{
    /**
     * The longest side a stored photo keeps, in pixels: sharp on any phone
     * or laptop screen, and a fraction of the size of a camera original.
     */
    private const MAX_DIMENSION = 1600;

    /**
     * WebP quality out of 100: no visible loss on a photo of a part or a
     * machine.
     */
    private const QUALITY = 80;

    /**
     * Put an uploaded photo on the public disk as a WebP no bigger than it
     * needs to be, turned the way the phone was held, so pages showing it
     * load fast. A photo GD can't open is kept as it was uploaded.
     */
    public function handle(UploadedFile $image, string $directory): string|false
    {
        $bytes = (string) file_get_contents($image->getRealPath());
        $source = function_exists('imagewebp') && $bytes !== '' ? @imagecreatefromstring($bytes) : false;

        if (! $source instanceof GdImage) {
            return $image->store($directory, 'public');
        }

        $optimized = $this->shrink($this->upright($source, $bytes));

        ob_start();
        imagewebp($optimized, null, self::QUALITY);
        $webp = (string) ob_get_clean();

        $path = $directory.'/'.Str::random(40).'.webp';

        return Storage::disk('public')->put($path, $webp) ? $path : false;
    }

    /**
     * Scale the image down to fit MAX_DIMENSION, keeping its shape and any
     * transparency. Smaller images are left their size.
     */
    private function shrink(GdImage $image): GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1, self::MAX_DIMENSION / max($width, $height));
        $fitWidth = max(1, (int) round($width * $scale));
        $fitHeight = max(1, (int) round($height * $scale));

        $canvas = imagecreatetruecolor($fitWidth, $fitHeight);
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        imagefill($canvas, 0, 0, (int) imagecolorallocatealpha($canvas, 0, 0, 0, 127));
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $fitWidth, $fitHeight, $width, $height);

        return $canvas;
    }

    /**
     * Turn a phone photo the right way up, the way its EXIF data says it
     * was held. The WebP saved from it keeps no EXIF, so this is the only
     * chance to.
     */
    private function upright(GdImage $image, string $bytes): GdImage
    {
        $exif = function_exists('exif_read_data')
            ? @exif_read_data('data://image/jpeg;base64,'.base64_encode($bytes))
            : false;

        $turn = match ((int) (is_array($exif) ? ($exif['Orientation'] ?? 1) : 1)) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };

        return $turn === 0 ? $image : (imagerotate($image, $turn, 0) ?: $image);
    }
}
