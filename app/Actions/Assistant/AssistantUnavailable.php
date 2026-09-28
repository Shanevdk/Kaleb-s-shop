<?php

namespace App\Actions\Assistant;

use RuntimeException;

/**
 * The assistant could not answer: it is not set up, or the model behind it
 * failed. The message is written for the person asking.
 */
class AssistantUnavailable extends RuntimeException
{
    //
}
