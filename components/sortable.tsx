"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

type Handle = { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined };

function Item({ id, children }: { id: string; children: (handle: Handle, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        position: "relative",
      }}
    >
      {children({ attributes: attributes as unknown as Record<string, unknown>, listeners }, isDragging)}
    </div>
  );
}

/**
 * Reorderable list or grid. Touch needs a short hold before dragging so the
 * page can still scroll; a mouse drags after a few pixels.
 */
export function Sortable<T>({
  items,
  getId,
  onReorder,
  grid,
  className,
  children,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  grid?: boolean;
  className?: string;
  children: (item: T, index: number, handle: Handle, dragging: boolean) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    onReorder(arrayMove(items, from, to));
    navigator.vibrate?.(8);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, i) => (
            <Item key={ids[i]} id={ids[i]}>
              {(handle, dragging) => children(item, i, handle, dragging)}
            </Item>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
