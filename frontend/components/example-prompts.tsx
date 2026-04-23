import { Card } from '@/components/ui/card';

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: 'Help me do a quick emotional check-in.',
  },
  {
    title: 'Give me grounding steps I can try right now.',
  },
  {
    title: 'Help me reflect on triggers I noticed today.',
  },
  {
    title: 'What do my uploaded support documents say about early warning signs?',
  },
];

export function ExamplePrompts({ onPromptSelect }: ExamplePromptsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
      {EXAMPLE_PROMPTS.map((prompt, i) => (
        <Card
          key={i}
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-2xl"
          onClick={() => onPromptSelect(prompt.title)}
        >
          <p className="text-sm text-center font-medium">{prompt.title}</p>
        </Card>
      ))}
    </div>
  );
}