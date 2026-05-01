import { Card } from '@/components/ui/card';

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void;
}

const EXAMPLE_PROMPTS = [
  {
    title: 'I really want a drink right now.',
  },
  {
    title: 'I slipped and drank last night.',
  },
  {
    title: 'I had a long day and I’m worried I drink too much.',
  },
  {
    title: 'Help me choose one safe next step for the next 10 minutes.',
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