import { Button } from "@/components/ui/button";

interface SubjectiveCheckInOptionProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function SubjectiveCheckInOption({
  label,
  selected,
  disabled,
  onClick,
}: SubjectiveCheckInOptionProps) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full text-xs"
    >
      {label}
    </Button>
  );
}