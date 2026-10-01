<?php

namespace App\Http\Controllers;

use App\Actions\DecodeBarcode;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Lends a phone's camera to a computer: the computer shows a QR code, the
 * phone opens it and scans barcodes, and each one turns up on the computer.
 * The phone needs no login; the link is secret, signed and short lived.
 */
class PhoneScannerController extends Controller
{
    /**
     * How long a phone stays paired before the link stops working.
     */
    private const MINUTES = 30;

    /**
     * Start pairing a phone, handing back the QR code it scans.
     */
    public function store(Request $request): JsonResponse
    {
        $token = Str::random(40);
        $expiresAt = now()->addMinutes(self::MINUTES);

        Cache::put(self::key($token), [
            'user_id' => $request->user()->id,
            'expires_at' => $expiresAt->toIso8601String(),
            'connected' => false,
            'scans' => [],
        ], $expiresAt);

        $url = URL::temporarySignedRoute('phone-scanner.show', $expiresAt, ['token' => $token]);

        return response()->json([
            'token' => $token,
            'url' => $url,
            'qr' => 'data:image/svg+xml;base64,'.base64_encode(self::qrCode($url)),
            'expires_at' => $expiresAt->toIso8601String(),
        ]);
    }

    /**
     * Show the phone its camera scanner.
     */
    public function show(string $token): Response
    {
        $session = Cache::get(self::key($token));

        if ($session !== null) {
            $session['connected'] = true;
            Cache::put(self::key($token), $session, Carbon::parse($session['expires_at']));
        }

        return Inertia::render('phone-scanner', [
            'expired' => $session === null,
            'scanUrl' => $session === null ? null : URL::temporarySignedRoute(
                'phone-scanner.scan',
                Carbon::parse($session['expires_at']),
                ['token' => $token],
            ),
            'scanner' => [
                'license_key' => (string) config('services.scandit.license_key'),
                'library_location' => (string) config('services.scandit.library_location'),
            ],
        ]);
    }

    /**
     * Take a barcode the phone scanned, work out what it is, and queue it up
     * for the computer.
     */
    public function scan(Request $request, string $token, DecodeBarcode $decoder): JsonResponse
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string', 'max:255'],
        ]);

        $decoded = $decoder->handle($validated['barcode']);

        $scan = Cache::lock(self::key($token).':lock', 5)->block(3, function () use ($token, $decoded): ?array {
            $session = Cache::get(self::key($token));

            if ($session === null) {
                return null;
            }

            $scan = [
                'id' => count($session['scans']) + 1,
                'barcode' => $decoded['barcode'],
                'description' => $decoded['description'],
                'brand' => $decoded['brand'],
                'source' => $decoded['source'],
                'inventory_item_id' => $decoded['inventory_item']?->id,
            ];

            $session['scans'][] = $scan;
            Cache::put(self::key($token), $session, Carbon::parse($session['expires_at']));

            return $scan;
        });

        if ($scan === null) {
            return response()->json(['message' => __('This link has expired. Scan a fresh QR code from the computer.')], 410);
        }

        return response()->json($scan);
    }

    /**
     * Hand the computer whatever the phone has scanned since it last asked.
     */
    public function poll(Request $request, string $token): JsonResponse
    {
        $session = Cache::get(self::key($token));

        if ($session === null) {
            return response()->json(['expired' => true, 'connected' => false, 'scans' => []]);
        }

        abort_unless($session['user_id'] === $request->user()->id, 404);

        $after = $request->integer('after');

        return response()->json([
            'expired' => false,
            'connected' => $session['connected'],
            'scans' => array_values(array_filter($session['scans'], fn (array $scan): bool => $scan['id'] > $after)),
        ]);
    }

    /**
     * Get the cache key a pairing lives under.
     */
    private static function key(string $token): string
    {
        return "phone-scanner:{$token}";
    }

    /**
     * Draw the link as a QR code.
     */
    private static function qrCode(string $url): string
    {
        $writer = new Writer(new ImageRenderer(new RendererStyle(240, 1), new SvgImageBackEnd));

        return $writer->writeString($url);
    }
}
