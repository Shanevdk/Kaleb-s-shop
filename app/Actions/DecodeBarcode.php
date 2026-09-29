<?php

namespace App\Actions;

use App\Models\InventoryItem;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class DecodeBarcode
{
    /**
     * The Open Food Facts family: open source and open data, free and
     * keyless. Asking for every product type searches food, beauty, pet food
     * and general products (Open Products Facts) in one go. It asks callers to
     * name themselves and keep to about 15 lookups a minute.
     */
    private const OPEN_FACTS_ENDPOINT = 'https://world.openfoodfacts.org/api/v3/product/';

    /**
     * UPCitemdb's free tier: no key or sign up, 100 lookups a day. Not open
     * source, but it knows far more retail and automotive products (oils,
     * filters, globes) than the open databases, so it catches what they miss.
     */
    private const UPCITEMDB_ENDPOINT = 'https://api.upcitemdb.com/prod/trial/lookup';

    /**
     * Work out what a scanned code is: a part already on the shelves, or a
     * product one of the free barcode databases knows about.
     *
     * Only retail barcodes (UPC, EAN and GTIN, 8 to 14 digits) are sent off.
     * QR codes and shop labels are the shop's own, so nobody else knows them.
     *
     * @return array{barcode: string, description: string|null, brand: string|null, source: 'inventory'|'lookup'|null, inventory_item: InventoryItem|null}
     */
    public function handle(string $code): array
    {
        $barcode = trim($code);

        $item = InventoryItem::query()->where('barcode', $barcode)->first();

        if ($item instanceof InventoryItem) {
            return [
                'barcode' => $barcode,
                'description' => $item->name,
                'brand' => $item->brand,
                'source' => 'inventory',
                'inventory_item' => $item,
            ];
        }

        $product = $this->lookUp($barcode);

        return [
            'barcode' => $barcode,
            'description' => $product['description'] ?? null,
            'brand' => $product['brand'] ?? null,
            'source' => $product === null ? null : 'lookup',
            'inventory_item' => null,
        ];
    }

    /**
     * Ask the free databases about a retail barcode, open ones first.
     *
     * A miss, an entry with no name, a spent allowance or an outage all fall
     * through to the next database, and to null at the end rather than an
     * error, so the part can still be described by hand.
     *
     * @return array{description: string, brand: string|null}|null
     */
    private function lookUp(string $barcode): ?array
    {
        if (! preg_match('/^\d{8,14}$/', $barcode)) {
            return null;
        }

        return Cache::remember(
            "barcode-decode:{$barcode}",
            now()->addMonth(),
            fn (): ?array => $this->fromOpenFacts($barcode) ?? $this->fromUpcItemDb($barcode),
        );
    }

    /**
     * Look the barcode up across the Open Food Facts family.
     *
     * @return array{description: string, brand: string|null}|null
     */
    private function fromOpenFacts(string $barcode): ?array
    {
        try {
            $response = Http::acceptJson()
                ->withUserAgent(config('app.name').'/1.0 ('.config('app.url').')')
                ->timeout(10)
                ->get(self::OPEN_FACTS_ENDPOINT.$barcode, [
                    'product_type' => 'all',
                    'fields' => 'product_name,generic_name,brands',
                ])
                ->throw();
        } catch (ConnectionException|RequestException) {
            return null;
        }

        return $this->describe(
            $response->json('product.product_name') ?: $response->json('product.generic_name'),
            $response->json('product.brands'),
        );
    }

    /**
     * Look the barcode up on UPCitemdb's free tier.
     *
     * @return array{description: string, brand: string|null}|null
     */
    private function fromUpcItemDb(string $barcode): ?array
    {
        try {
            $response = Http::acceptJson()
                ->timeout(10)
                ->get(self::UPCITEMDB_ENDPOINT, ['upc' => $barcode])
                ->throw();
        } catch (ConnectionException|RequestException) {
            return null;
        }

        return $this->describe($response->json('items.0.title'), $response->json('items.0.brand'));
    }

    /**
     * Tidy a database's answer into a description and a brand, or null when
     * it did not actually name the product.
     *
     * @return array{description: string, brand: string|null}|null
     */
    private function describe(mixed $title, mixed $brands): ?array
    {
        $title = trim((string) $title);

        if ($title === '') {
            return null;
        }

        // Brands can come back as a comma separated list; the first is the maker.
        $brand = trim(explode(',', (string) $brands)[0]);

        return [
            'description' => mb_substr($title, 0, 255),
            'brand' => $brand === '' ? null : mb_substr($brand, 0, 255),
        ];
    }
}
