<?php

use App\Actions\StoreOptimizedImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('a photo already small enough keeps its size', function () {
    Storage::fake('public');

    $path = app(StoreOptimizedImage::class)->handle(UploadedFile::fake()->image('part.png', 640, 480), 'inventory');
    $size = getimagesizefromstring(Storage::disk('public')->get($path));

    expect($path)->toStartWith('inventory/')->toEndWith('.webp')
        ->and([$size[0], $size[1]])->toBe([640, 480]);
});

test('a file that cannot be opened as an image is kept as it was uploaded', function () {
    Storage::fake('public');

    $path = app(StoreOptimizedImage::class)->handle(UploadedFile::fake()->createWithContent('part.jpg', 'not really a photo'), 'inventory');

    expect($path)->toEndWith('.jpg')
        ->and(Storage::disk('public')->get($path))->toBe('not really a photo');
});
