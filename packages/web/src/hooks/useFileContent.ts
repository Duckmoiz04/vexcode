import { useState, useEffect, useRef } from 'react';

interface FileContentResult {
  content: string;
  isLoading: boolean;
  error: string | null;
}

export function useFileContent(filePath: string | null): FileContentResult {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!filePath) {
      setContent('');
      setIsLoading(false);
      setError(null);
      return;
    }

    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    const fetchFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/file-content?path=${encodeURIComponent(filePath)}`,
          { signal: controller.signal }
        );
        const data = await response.json();

        if (cancelled) return;

        if (data.success) {
          setContent(data.content);
        } else {
          setContent('');
          setError('Failed to load file content');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load file content';
        setContent('');
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchFile();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filePath]);

  return { content, isLoading, error };
}