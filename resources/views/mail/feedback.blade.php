@php
    // Typed-in text is shown as written: without a [ it cannot become a link or image.
    $plain = fn (?string $text): string => str_replace('[', '\[', (string) $text);
@endphp
<x-mail::message>
# {{ $plain($sender->name) }} sent feedback

<x-mail::panel>
{!! nl2br(e($plain($feedback->message))) !!}
</x-mail::panel>

@if ($pageUrl)
Sent from {{ $plain($pageUrl) }}

@endif
Reply to this email to answer {{ $plain($sender->name) }} directly at {{ $sender->email }}.

<x-mail::button :url="$inboxUrl">
Open feedback
</x-mail::button>

{{ config('app.name') }}
</x-mail::message>
