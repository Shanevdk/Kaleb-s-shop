<?php

namespace App\Http\Controllers\Admin;

use App\Actions\ExportShopData;
use App\Http\Controllers\Controller;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\StreamedJsonResponse;

class DataExportController extends Controller
{
    /**
     * Download everything the shop shares with other apps as one JSON file,
     * the same as the API's export, to keep or to load into another app.
     */
    public function download(ExportShopData $exportShopData): StreamedJsonResponse
    {
        $filename = 'shop-data-'.now()->format('Y-m-d-Hi').'.json';

        return response()->streamJson($exportShopData->everything(), headers: [
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $filename),
        ]);
    }
}
