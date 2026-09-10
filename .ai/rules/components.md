---
paths:
    - 'resources/js/components/**'
---

# Components

## File uploads on update forms must spoof the method

PHP does not parse a multipart body on PUT/PATCH, and Inertia v3's `<Form>` component does not accept `forceFormData` in its `options` prop (only `useForm`/`router` do). So an update form that can carry a file must post to the update URL with `method: 'post'` and add `_method: 'put'` via the `transform` prop — but only when a file is actually selected, otherwise the plain JSON PUT is fine and `_method` in a JSON body is ignored by Laravel. See `resources/js/components/inventory-item-form.tsx` for the pattern.
