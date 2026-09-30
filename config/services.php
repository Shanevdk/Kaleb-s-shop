<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'openrouter' => [
        'key' => env('OPENROUTER_API_KEY'),
        'url' => env('OPENROUTER_URL', 'https://openrouter.ai/api/v1'),
        'model' => env('OPENROUTER_MODEL', 'nvidia/nemotron-3-super-120b-a12b:free'),
        // Tried in order when the main model is down or rate limited. Free
        // models are often rate limited upstream one at a time, so the list is
        // long, ending with OpenRouter's router across every free model.
        'fallback_models' => array_filter(explode(',', (string) env(
            'OPENROUTER_FALLBACK_MODELS',
            'nvidia/nemotron-3-ultra-550b-a55b:free,nvidia/nemotron-3.5-lightning:free,qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free,openrouter/free',
        ))),
        // Free models that can see pictures, tried in order when matching a
        // vehicle's 3D model to its photos.
        'vision_models' => array_filter(explode(',', (string) env(
            'OPENROUTER_VISION_MODELS',
            'google/gemma-4-31b-it:free,qwen/qwen3.8-27b:free,google/gemma-4-26b-a4b-it:free,thinkingmachines/inkling:free,openrouter/free',
        ))),
    ],

    'scandit' => [
        'license_key' => env('SCANDIT_LICENSE_KEY'),
        'library_location' => env(
            'SCANDIT_LIBRARY_LOCATION',
            'https://cdn.jsdelivr.net/npm/@scandit/web-datacapture-barcode@8.6.0/sdc-lib/',
        ),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
