import { ZylumStudio } from "@/components/ZylumStudio";

type Props = {
  params: Promise<{ canvasId: string }>;
};

export default async function CanvasPage({ params }: Props) {
  const { canvasId } = await params;
  return <ZylumStudio canvasId={canvasId} />;
}
