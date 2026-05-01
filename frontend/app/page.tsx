'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  HeartPulse,
  Loader2,
  MessageCircleHeart,
  Paperclip,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';

import { ExamplePrompts } from '@/components/example-prompts';
import { FilePreview } from '@/components/file-preview';
import { ChatMessage } from '@/components/chat-message';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { client } from '@/lib/langgraph-client';
import {
  PDFDocument,
  RetrieveDocumentsNodeUpdates,
} from '@/types/graphTypes';

export default function Home() {
  const { toast } = useToast();

  const [messages, setMessages] = useState<
    Array<{
      role: 'user' | 'assistant';
      content: string;
      sources?: PDFDocument[];
    }>
  >([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastRetrievedDocsRef = useRef<PDFDocument[]>([]);

  useEffect(() => {
    const initThread = async () => {
      if (threadId) return;

      try {
        const thread = await client.createThread();
        setThreadId(thread.thread_id);
      } catch (error) {
        console.error('Error creating thread:', error);
        toast({
          title: 'Error',
          description:
            'Error creating thread. Please make sure you have set the LANGGRAPH_API_URL environment variable correctly. ' +
            error,
          variant: 'destructive',
        });
      }
    };

    initThread();
  }, [threadId, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId || isLoading) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const userMessage = input.trim();

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage, sources: undefined },
      { role: 'assistant', content: '', sources: undefined },
    ]);
    setInput('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastRetrievedDocsRef.current = [];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          threadId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value);
        const lines = chunkStr.split('\n').filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const sseString = line.slice('data: '.length);
          let sseEvent: any;

          try {
            sseEvent = JSON.parse(sseString);
          } catch (err) {
            console.error('Error parsing SSE line:', err, line);
            continue;
          }

          const { event, data } = sseEvent;

          if (event === 'messages/partial') {
            if (Array.isArray(data)) {
              const lastObj = data[data.length - 1];

              if (lastObj?.type === 'ai') {
                const partialContent = lastObj.content ?? '';

                if (
                  typeof partialContent === 'string' &&
                  !partialContent.startsWith('{')
                ) {
                  setMessages((prev) => {
                    const newArr = [...prev];

                    if (
                      newArr.length > 0 &&
                      newArr[newArr.length - 1].role === 'assistant'
                    ) {
                      newArr[newArr.length - 1].content = partialContent;
                      newArr[newArr.length - 1].sources =
                        lastRetrievedDocsRef.current;
                    }

                    return newArr;
                  });
                }
              }
            }
          } else if (event === 'updates' && data) {
            if (
              data &&
              typeof data === 'object' &&
              'retrieveDocuments' in data &&
              data.retrieveDocuments &&
              Array.isArray(data.retrieveDocuments.documents)
            ) {
              const retrievedDocs = (data as RetrieveDocumentsNodeUpdates)
                .retrieveDocuments.documents as PDFDocument[];
              lastRetrievedDocsRef.current = retrievedDocs;
              console.log('Retrieved documents:', retrievedDocs);
            } else {
              lastRetrievedDocsRef.current = [];
            }
          } else {
            console.log('Unknown SSE event:', event, data);
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description:
          'Failed to send message. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });

      setMessages((prev) => {
        const newArr = [...prev];
        newArr[newArr.length - 1].content =
          'Sorry, there was an error processing your message.';
        return newArr;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const nonPdfFiles = selectedFiles.filter(
      (file) => file.type !== 'application/pdf',
    );

    if (nonPdfFiles.length > 0) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload PDF files only',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload files');
      }

      if (!data.threadId) {
        throw new Error('Upload succeeded but no threadId was returned');
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      lastRetrievedDocsRef.current = [];
      setMessages([]);
      setInput('');
      setFiles(selectedFiles);
      setThreadId(data.threadId);

      toast({
        title: 'Resources added',
        description: `${selectedFiles.length} document${
          selectedFiles.length > 1 ? 's' : ''
        } uploaded successfully. New chats will now be grounded only in this upload.`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Upload failed',
        description:
          'Failed to upload files. Please try again.\n' +
          (error instanceof Error ? error.message : 'Unknown error'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFiles(files.filter((file) => file !== fileToRemove));
    toast({
      title: 'Document removed',
      description: `${fileToRemove.name} has been removed`,
      variant: 'default',
    });
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 md:px-6 md:py-10">
        <div className="space-y-4 mb-6">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                Safety-aware support
              </p>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Recovery Support Assistant
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                A supportive chat experience for check-ins, grounding,
                reflection, and document-grounded guidance. This assistant is
                intended to stay safety-bounded and can reference uploaded
                support resources, care protocols, and recovery documents.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
                Check-in
              </span>
              <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
                Grounded support
              </span>
              <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
                Safety planning
              </span>
              <span className="text-xs rounded-full border px-3 py-1 text-muted-foreground">
                Resource Q&amp;A
              </span>
            </div>
          </div>

          <Card className="rounded-2xl border">
            <CardContent className="p-4 md:p-5 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Safety boundaries</p>
                  <p className="text-sm text-muted-foreground">
                    This assistant is for supportive conversation, grounding,
                    reflection, and document-grounded guidance. It is not a
                    crisis service, not a substitute for a clinician, and should
                    not be relied on for emergency or medication decisions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <TriangleAlert className="h-5 w-5 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  If there is immediate danger, medical emergency, overdose
                  concern, or risk of self-harm, seek urgent local emergency or
                  crisis support right away.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {messages.length === 0 ? (
          <div className="space-y-6 pb-40">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageCircleHeart className="h-5 w-5" />
                    <h2 className="font-medium">How I can help</h2>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>Supportive check-ins and reflection</li>
                    <li>Grounding and coping prompts</li>
                    <li>Structured conversation around warning signs</li>
                    <li>Grounded answers from uploaded support documents</li>
                    <li>Safety-minded planning conversations</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5" />
                    <h2 className="font-medium">What I will not do</h2>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>Provide diagnosis or critical medical advice</li>
                    <li>Provide medication instructions</li>
                    <li>Give harmful, dangerous, or self-harm-enabling guidance</li>
                    <li>Act as an autonomous clinical decision-maker</li>
                    <li>Replace urgent emergency support</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  <h2 className="font-medium">Grounding with documents</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload safety plans, recovery notes, crisis protocols, care
                  instructions, or research summaries to make responses more
                  grounded and less dependent on free-form generation.
                </p>
              </CardContent>
            </Card>

            <ExamplePrompts onPromptSelect={setInput} />
          </div>
        ) : (
          <div className="w-full space-y-4 pb-40">
            {messages.map((message, i) => (
              <ChatMessage key={i} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t">
        <div className="max-w-5xl mx-auto space-y-3">
          <p className="text-xs text-muted-foreground">
            The current conversation is grounded in the most recently uploaded
            document set.
          </p>

          {files.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {files.map((file, index) => (
                <FilePreview
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() => handleRemoveFile(file)}
                />
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <div className="flex gap-2 border rounded-2xl overflow-hidden bg-gray-50">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf"
                multiple
                className="hidden"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-none h-12"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>

              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isUploading
                    ? 'Uploading support documents...'
                    : 'Ask for support, reflection, grounding, or document-grounded guidance...'
                }
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-12 bg-transparent"
                disabled={isUploading || isLoading || !threadId}
              />

              <Button
                type="submit"
                size="icon"
                className="rounded-none h-12"
                disabled={!input.trim() || isUploading || isLoading || !threadId}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}