<?php

namespace App\Enums;

enum ChecklistChange: string
{
    case Add = 'add';
    case Remove = 'remove';
}
