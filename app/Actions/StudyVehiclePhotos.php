<?php

namespace App\Actions;

use App\Actions\Assistant\AssistantUnavailable;
use App\Actions\Assistant\OpenRouter;
use App\Enums\PhotoAngle;
use App\Models\Vehicle;
use GdImage;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StudyVehiclePhotos
{
    /**
     * Seconds to wait for one model to look at the photos.
     */
    private const TIMEOUT = 60;

    /**
     * Seconds after which no further model is tried.
     */
    private const BUDGET = 100;

    /**
     * The size of each photo on the contact sheet, and of its label bar.
     */
    private const CELL_WIDTH = 640;

    private const CELL_HEIGHT = 480;

    private const LABEL_HEIGHT = 26;

    /**
     * @var array<int, string>
     */
    private const FINISHES = ['solid', 'metallic', 'pearl', 'matte'];

    /**
     * @var array<int, string>
     */
    private const BODY_STYLES = [
        'sedan', 'hatchback', 'wagon', 'coupe', 'convertible', 'suv', 'ute', 'van', 'truck', 'bus', 'motorcycle', 'other',
    ];

    /**
     * @var array<int, string>
     */
    private const CABS = ['single', 'extra', 'dual'];

    /**
     * @var array<int, string>
     */
    private const ROOFS = ['standard', 'high'];

    /**
     * @var array<int, string>
     */
    private const WHEEL_STYLES = ['steel', 'hubcap', 'alloy'];

    /**
     * @var array<int, string>
     */
    private const WHEEL_COLOURS = ['silver', 'black', 'gunmetal', 'bronze', 'white', 'chrome'];

    /**
     * @var array<int, string>
     */
    private const ACCESSORIES = [
        'bull_bar', 'nudge_bar', 'roof_rack', 'roof_rails', 'ladder_rack', 'tow_bar', 'canopy', 'tonneau_cover',
        'sports_bar', 'snorkel', 'side_steps', 'spotlights', 'light_bar', 'mud_flaps', 'sunroof', 'rooftop_tent',
    ];

    /**
     * @var array<int, string>
     */
    private const DAMAGE_AREAS = [
        'front_bumper', 'rear_bumper', 'bonnet', 'roof', 'windscreen', 'rear_window', 'grille',
        'left_headlight', 'right_headlight', 'left_taillight', 'right_taillight', 'left_mirror', 'right_mirror',
        'front_left_door', 'front_right_door', 'rear_left_door', 'rear_right_door',
        'left_front_guard', 'right_front_guard', 'left_rear_quarter', 'right_rear_quarter', 'left_sill', 'right_sill',
        'left_front_wheel', 'right_front_wheel', 'left_rear_wheel', 'right_rear_wheel', 'tailgate', 'tray', 'other',
    ];

    /**
     * @var array<int, string>
     */
    private const DAMAGE_KINDS = ['dent', 'scratch', 'scrape', 'rust', 'crack', 'missing', 'flat_tyre', 'other'];

    /**
     * @var array<int, string>
     */
    private const SEVERITIES = ['minor', 'moderate', 'severe'];

    public function __construct(private OpenRouter $openRouter) {}

    /**
     * Show a model that can see pictures the vehicle's photos and keep what
     * it makes of them: the paint, the body, the wheels, what is bolted on
     * and any damage, so the 3D model can be matched to the real thing.
     *
     * The photos go over as one labelled contact sheet, so a model that
     * only takes a single picture still sees every side. Models are tried
     * in turn until one gives an answer that can be read.
     *
     * @return array<string, mixed>
     *
     * @throws AssistantUnavailable
     */
    public function handle(Vehicle $vehicle): array
    {
        $this->openRouter->ensureConfigured();

        $photos = $vehicle->photosToStudy();
        $messages = [
            ['role' => 'system', 'content' => $this->instructions()],
            ['role' => 'user', 'content' => [
                ['type' => 'text', 'text' => $this->brief($vehicle, array_keys($photos))],
                ['type' => 'image_url', 'image_url' => ['url' => $this->contactSheet($photos)]],
            ]],
        ];

        $started = hrtime(true);
        $failure = __('The AI could not make sense of the photos. Try again in a minute.');

        /** @var array<int, string> $models */
        $models = config('services.openrouter.vision_models');

        foreach ($models as $model) {
            if ((hrtime(true) - $started) / 1e9 > self::BUDGET) {
                break;
            }

            try {
                ['message' => $message, 'model' => $answeredBy] = $this->openRouter->complete($messages, [], self::TIMEOUT, [$model]);
            } catch (AssistantUnavailable $exception) {
                $failure = $exception->getMessage();

                continue;
            }

            $look = $this->parse($this->content($message));

            if ($look === null) {
                $failure = __('The AI could not make sense of the photos. Try again in a minute.');

                continue;
            }

            $vehicle->update(['look' => [
                ...$look,
                'angles' => array_keys($photos),
                'sources' => $photos,
                'model' => $answeredBy,
                'studied_at' => now()->toIso8601String(),
            ]]);

            return $vehicle->look;
        }

        throw new AssistantUnavailable($failure);
    }

    /**
     * Tell the model what to look for and how to answer.
     */
    private function instructions(): string
    {
        $areas = implode(', ', self::DAMAGE_AREAS);

        return <<<PROMPT
        You look at photos of one vehicle or machine for a mechanic's workshop and describe how it looks, so a 3D model of it can be made to match. The picture is a contact sheet: every photo on it is of the same vehicle, and each is labelled with where it was taken from. Left and right always mean the vehicle's own left and right, as if sitting in it facing forward.

        Answer with ONLY a JSON object, no prose before or after and no markdown fences, in exactly this shape:
        {
          "colour": {"name": "the everyday name of the main paint colour, e.g. white, silver, dark blue", "hex": "#rrggbb, the paint as it would look in soft daylight", "finish": "solid" | "metallic" | "pearl" | "matte"},
          "body_style": "sedan" | "hatchback" | "wagon" | "coupe" | "convertible" | "suv" | "ute" | "van" | "truck" | "bus" | "motorcycle" | "other",
          "cab": "single" | "extra" | "dual" | null,
          "roof": "standard" | "high" | null,
          "wheels": {"style": "steel" | "hubcap" | "alloy", "spokes": the number of spokes or null, "colour": "silver" | "black" | "gunmetal" | "bronze" | "white" | "chrome"},
          "tinted_windows": true | false,
          "accessories": ["bull_bar", "nudge_bar", "roof_rack", "roof_rails", "ladder_rack", "tow_bar", "canopy", "tonneau_cover", "sports_bar", "snorkel", "side_steps", "spotlights", "light_bar", "mud_flaps", "sunroof", "rooftop_tent"],
          "damage": [{"area": "front_left_door", "kind": "dent" | "scratch" | "scrape" | "rust" | "crack" | "missing" | "flat_tyre" | "other", "severity": "minor" | "moderate" | "severe", "note": "what you can see, in a few words"}],
          "summary": "One or two sentences on how it looks, the way a mechanic would describe it at the counter.",
          "confidence": a number from 0 to 1 for how sure you are overall
        }

        "cab" is only for utes and pickups and "roof" only for vans; use null for anything else. List only the accessories you can actually see, and only damage you can actually see, with the area as one of: {$areas}. Use an empty list when there is none. If a photo is too dark or blurry to tell something, leave it out rather than guess.
        PROMPT;
    }

    /**
     * Say what the shop already knows about the vehicle and what is on the
     * contact sheet.
     *
     * @param  array<int, string>  $angles
     */
    private function brief(Vehicle $vehicle, array $angles): string
    {
        $labels = array_map(
            fn (string $angle, int $index): string => ($index + 1).' '.PhotoAngle::from($angle)->label(),
            $angles,
            array_keys($angles),
        );

        return implode("\n", array_filter([
            "The shop has this down as a {$vehicle->year} {$vehicle->make} {$vehicle->model}, a ".Str::lower($vehicle->machineKind()->label()).'.',
            filled($vehicle->colour) ? "Colour on file: {$vehicle->colour}." : 'No colour on file.',
            filled($vehicle->specs['body_class'] ?? null) ? "Body on file: {$vehicle->specs['body_class']}." : null,
            'The contact sheet has '.count($labels).' '.Str::plural('photo', count($labels)).': '.implode(', ', $labels).'.',
        ]));
    }

    /**
     * Lay the photos out on one contact sheet, each labelled with its number
     * and where it was taken from, as a JPEG data URL.
     *
     * @param  array<string, string>  $photos
     *
     * @throws AssistantUnavailable
     */
    private function contactSheet(array $photos): string
    {
        if (! function_exists('imagecreatetruecolor')) {
            throw new AssistantUnavailable(__('Matching photos needs the GD image extension in PHP.'));
        }

        $images = [];

        foreach ($photos as $angle => $path) {
            $bytes = Storage::disk('public')->get($path);
            $image = is_string($bytes) ? @imagecreatefromstring($bytes) : false;

            if ($image instanceof GdImage) {
                $images[$angle] = $this->upright($image, $bytes);
            }
        }

        if ($images === []) {
            throw new AssistantUnavailable(__('None of the photos could be opened. Try taking them again.'));
        }

        $columns = count($images) === 1 ? 1 : (count($images) <= 4 ? 2 : 3);
        $rows = (int) ceil(count($images) / $columns);
        $cell = self::LABEL_HEIGHT + self::CELL_HEIGHT;
        $sheet = imagecreatetruecolor($columns * self::CELL_WIDTH, $rows * $cell);
        imagefill($sheet, 0, 0, (int) imagecolorallocate($sheet, 24, 26, 29));
        $ink = (int) imagecolorallocate($sheet, 255, 255, 255);
        $index = 0;

        foreach ($images as $angle => $image) {
            $left = ($index % $columns) * self::CELL_WIDTH;
            $top = intdiv($index, $columns) * $cell;
            $width = imagesx($image);
            $height = imagesy($image);
            $scale = min(self::CELL_WIDTH / $width, self::CELL_HEIGHT / $height);
            $fitWidth = max(1, (int) round($width * $scale));
            $fitHeight = max(1, (int) round($height * $scale));

            imagecopyresampled(
                $sheet,
                $image,
                $left + intdiv(self::CELL_WIDTH - $fitWidth, 2),
                $top + self::LABEL_HEIGHT + intdiv(self::CELL_HEIGHT - $fitHeight, 2),
                0,
                0,
                $fitWidth,
                $fitHeight,
                $width,
                $height,
            );
            imagestring($sheet, 5, $left + 10, $top + 5, ($index + 1).'  '.Str::upper(PhotoAngle::from($angle)->label()), $ink);
            $index++;
        }

        ob_start();
        imagejpeg($sheet, null, 84);

        return 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());
    }

    /**
     * Turn a phone photo the right way up, the way its EXIF data says it
     * was held.
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

    /**
     * Get the text of the model's answer, which some providers send as a
     * list of parts.
     *
     * @param  array<string, mixed>  $message
     */
    private function content(array $message): string
    {
        $content = $message['content'] ?? '';

        if (is_array($content)) {
            $content = collect($content)
                ->map(fn (mixed $part): string => is_array($part) ? (string) ($part['text'] ?? '') : (string) $part)
                ->implode('');
        }

        return trim((string) $content);
    }

    /**
     * Read the model's JSON answer, forgiving the fences and chatter free
     * models like to wrap it in, and keep only what fits the vocabulary the
     * 3D model understands. Null when nothing usable came back.
     *
     * @return array<string, mixed>|null
     */
    private function parse(string $content): ?array
    {
        $start = strpos($content, '{');
        $end = strrpos($content, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        $data = json_decode(substr($content, $start, $end - $start + 1), true);

        if (! is_array($data)) {
            return null;
        }

        $look = [
            'colour' => $this->colour($data['colour'] ?? null),
            'body_style' => $this->oneOf($data['body_style'] ?? null, self::BODY_STYLES),
            'cab' => $this->oneOf($data['cab'] ?? null, self::CABS),
            'roof' => $this->oneOf($data['roof'] ?? null, self::ROOFS),
            'wheels' => $this->wheels($data['wheels'] ?? null),
            'tinted_windows' => is_bool($data['tinted_windows'] ?? null) ? $data['tinted_windows'] : null,
            'accessories' => collect(is_array($data['accessories'] ?? null) ? $data['accessories'] : [])
                ->map(fn (mixed $accessory): ?string => $this->oneOf($accessory, self::ACCESSORIES))
                ->filter()
                ->unique()
                ->values()
                ->all(),
            'damage' => collect(is_array($data['damage'] ?? null) ? $data['damage'] : [])
                ->filter(fn (mixed $mark): bool => is_array($mark))
                ->take(12)
                ->map(fn (array $mark): array => [
                    'area' => $this->oneOf($mark['area'] ?? null, self::DAMAGE_AREAS) ?? 'other',
                    'kind' => $this->oneOf($mark['kind'] ?? null, self::DAMAGE_KINDS) ?? 'other',
                    'severity' => $this->oneOf($mark['severity'] ?? null, self::SEVERITIES) ?? 'minor',
                    'note' => $this->text($mark['note'] ?? null, 160),
                ])
                ->values()
                ->all(),
            'summary' => $this->text($data['summary'] ?? null, 400) ?: null,
            'confidence' => is_numeric($data['confidence'] ?? null)
                ? round(min(1, max(0, (float) $data['confidence'])), 2)
                : null,
        ];

        if ($look['colour'] === null && $look['body_style'] === null && $look['summary'] === null) {
            return null;
        }

        return $look;
    }

    /**
     * Get the paint from the model's answer: a name, a hex value when it gave
     * a proper one, and the finish.
     *
     * @return array{name: string, hex: string|null, finish: string}|null
     */
    private function colour(mixed $colour): ?array
    {
        if (! is_array($colour)) {
            return null;
        }

        $hex = Str::lower(ltrim($this->text($colour['hex'] ?? null, 9), '#'));

        if (preg_match('/^[0-9a-f]{3}$/', $hex) === 1) {
            $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
        }

        $hex = preg_match('/^[0-9a-f]{6}$/', $hex) === 1 ? "#{$hex}" : null;
        $name = $this->text($colour['name'] ?? null, 40) ?: $hex;

        return $name === null ? null : [
            'name' => $name,
            'hex' => $hex,
            'finish' => $this->oneOf($colour['finish'] ?? null, self::FINISHES) ?? 'solid',
        ];
    }

    /**
     * Get the wheels from the model's answer.
     *
     * @return array{style: string, spokes: int|null, colour: string|null}|null
     */
    private function wheels(mixed $wheels): ?array
    {
        $style = is_array($wheels) ? $this->oneOf($wheels['style'] ?? null, self::WHEEL_STYLES) : null;

        if ($style === null) {
            return null;
        }

        $spokes = is_numeric($wheels['spokes'] ?? null) ? (int) $wheels['spokes'] : null;

        return [
            'style' => $style,
            'spokes' => $spokes !== null && $spokes >= 3 && $spokes <= 12 ? $spokes : null,
            'colour' => $this->oneOf($wheels['colour'] ?? null, self::WHEEL_COLOURS),
        ];
    }

    /**
     * Match a word from the model's answer against a list, however it was
     * spaced or cased: "Bull bar" is bull_bar.
     *
     * @param  array<int, string>  $allowed
     */
    private function oneOf(mixed $value, array $allowed): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $word = Str::of($value)->lower()->trim()->replaceMatches('/[\s-]+/', '_')->toString();

        return in_array($word, $allowed, true) ? $word : null;
    }

    /**
     * Get a trimmed piece of text from the model's answer.
     */
    private function text(mixed $value, int $limit): string
    {
        return is_scalar($value) ? Str::limit(trim((string) $value), $limit) : '';
    }
}
