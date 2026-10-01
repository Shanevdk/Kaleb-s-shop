import { useEffect, useState } from 'react';
import {
    getScreenSaverImageBlob,
    listScreenSaverImages,
    subscribeScreenSaverImages,
    type ScreenSaverImage,
} from '@/lib/screen-saver-images';

/**
 * The photos stored on this device for the screen saver, kept in sync with
 * IndexedDB as they are added or removed.
 */
export function useScreenSaverImages(): ScreenSaverImage[] {
    const [images, setImages] = useState<ScreenSaverImage[]>([]);

    useEffect(() => {
        const refresh = () => {
            listScreenSaverImages()
                .then(setImages)
                .catch(() => setImages([]));
        };

        refresh();

        return subscribeScreenSaverImages(refresh);
    }, []);

    return images;
}

/**
 * Object URLs for every stored photo, revoked automatically as the list
 * changes or the component using them unmounts.
 */
export function useScreenSaverImageUrls(): { id: string; url: string }[] {
    const images = useScreenSaverImages();
    const [urls, setUrls] = useState<{ id: string; url: string }[]>([]);

    useEffect(() => {
        let cancelled = false;
        const created: string[] = [];

        Promise.all(
            images.map(async (image) => {
                const blob = await getScreenSaverImageBlob(image.id);

                if (!blob) {
                    return null;
                }

                const url = URL.createObjectURL(blob);
                created.push(url);

                return { id: image.id, url };
            }),
        )
            .then((resolved) => {
                if (!cancelled) {
                    setUrls(
                        resolved.filter(
                            (entry): entry is { id: string; url: string } =>
                                entry !== null,
                        ),
                    );
                }
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
            created.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [images]);

    return urls;
}
