<?php

namespace App\Concerns;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;

/**
 * Delete a model's children along with it.
 *
 * MongoDB has no foreign keys, so nothing cleans up after a delete the way
 * `cascadeOnDelete` used to. Models list the relations that belong to them in
 * `$cascadeDeletes` and this deletes them on the way out.
 */
trait CascadesDeletes
{
    /**
     * Hook the cascade onto the model's delete.
     */
    public static function bootCascadesDeletes(): void
    {
        static::deleting(function (Model $model): void {
            foreach ($model->cascadeDeletes as $relation) {
                $related = $model->{$relation}();

                if ($related instanceof Relation) {
                    $related->get()->each(fn (Model $child) => $child->delete());
                }
            }
        });
    }
}
