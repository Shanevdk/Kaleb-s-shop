@php
    $money = fn (float $amount): string => '$'.number_format($amount, 2);
    $hours = fn (float $value): string => rtrim(rtrim(number_format($value, 2), '0'), '.').' h';
    $quantity = fn (float $value): string => rtrim(rtrim(number_format($value, 2), '0'), '.');
    $time = $sheet['time'];
    $cost = $sheet['cost'];
    // Typed-in text is shown as written: without a [ it cannot become a link or image.
    $plain = fn (?string $text): string => str_replace('[', '\[', (string) $text);
@endphp
<x-mail::message>
# {{ $plain($sheet['title']) }}

@if ($sheet['vehicle'])
**{{ $plain($sheet['vehicle']['name']) }}**@if ($sheet['vehicle']['registration']) · {{ $plain($sheet['vehicle']['registration']) }}@endif

@endif
@if ($note !== '')
{{ $plain($note) }}

@endif
## What's wrong

{{ $plain($sheet['reason']) }}

## Estimate

<x-mail::table>
| | |
| :-- | --: |
| **{{ $sheet['quoted_price'] !== null ? 'Price' : 'Estimated cost' }}** | **@if ($sheet['quoted_price'] !== null) {{ $money($sheet['quoted_price']) }} @elseif ($sheet['parts'] === []) No parts needed @elseif ($cost['unpriced'] === count($sheet['parts'])) {{ $sheet['estimating'] ? 'Being worked out' : 'To be confirmed' }} @else {{ $money($cost['total']) }}{{ $cost['unpriced'] > 0 ? ' + '.$cost['unpriced'].' unpriced' : '' }} @endif** |
| **Estimated repair time** | **@if ($time){{ $time['low'] !== null && $time['high'] !== null && $time['low'] !== $time['high'] ? $hours($time['low']).'–'.$hours($time['high']) : 'About '.$hours($time['hours']) }}@else {{ $sheet['estimating'] ? 'Being worked out' : 'To be confirmed' }} @endif** |
</x-mail::table>

@if ($sheet['parts'] !== [])
## Parts needed

<x-mail::table>
| Part | Qty | Cost |
| :-- | :-- | --: |
@foreach ($sheet['parts'] as $part)
| {{ $plain($part['name']) }} | {{ $quantity($part['quantity']) }} {{ $part['unit_abbreviation'] }} | {{ $part['line_total'] === null ? '—' : ($part['priced_by'] === 'estimate' ? '≈ ' : '').$money($part['line_total']) }} |
@endforeach
</x-mail::table>

@endif
<x-mail::button :url="$url">
View the full work order
</x-mail::button>

If the button does not work, open this link: [{{ $url }}]({{ $url }})

@if ($sheet['quoted_price'] !== null)
The price is set by the shop. Part costs come from stock prices, with ≈ marking a part priced by an AI estimate. The time is an AI estimate of how long the repair takes and may change once the work starts.
@else
Costs come from stock prices, with ≈ marking a part priced by an AI estimate. The time is an AI estimate of how long the repair takes. Both may change once the work starts.
@endif

Reply to this email with any questions.

Thanks,<br>
{{ $plain($sender->name) }}<br>
{{ config('app.name') }}
</x-mail::message>
