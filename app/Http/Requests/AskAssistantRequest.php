<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AskAssistantRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'messages' => ['required', 'array', 'min:1', 'max:40'],
            'messages.*.role' => ['required', Rule::in(['user', 'assistant'])],
            'messages.*.content' => ['required', 'string', 'max:4000'],
        ];
    }

    /**
     * Get the conversation so far, ending with the question to answer.
     *
     * @return array<int, array{role: string, content: string}>
     */
    public function conversation(): array
    {
        /** @var array<int, array{role: string, content: string}> $messages */
        $messages = $this->validated('messages');

        return array_map(fn (array $message): array => [
            'role' => $message['role'],
            'content' => trim($message['content']),
        ], array_values($messages));
    }
}
