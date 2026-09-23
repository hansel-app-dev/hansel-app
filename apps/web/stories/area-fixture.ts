import type { PlanArea } from '@hansel/contracts';
import type { PlanAreasApi } from '../src/sites/plan-areas-api.js';
export function areaFixture(): PlanAreasApi {
  let areas: PlanArea[] = [
    {
      id: '00000000-0000-4000-8000-000000000081',
      fileId: null,
      x: 0.2,
      y: 0.2,
      width: 0.3,
      height: 0.4,
      code: 'Ar.01',
      content: '',
      orientation: 'down',
      type: 'Floor',
      function: 'Environmental',
      colour: 'Blue',
      updatedAt: '2026-09-23T00:00:00.000Z',
    },
  ];
  return {
    load: () => Promise.resolve({ areas, canManageAreas: true }),
    create: (input) => {
      const area: PlanArea = {
        id: crypto.randomUUID(),
        fileId: input.fileId,
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        code: `Ar.${String(areas.length + 1).padStart(2, '0')}`,
        content: '',
        orientation: 'down',
        type: 'Floor',
        function: 'Environmental',
        colour: 'Blue',
        updatedAt: new Date().toISOString(),
      };
      areas.push(area);
      return Promise.resolve(area);
    },
    update: (id, input) => {
      const current = areas.find((a) => a.id === id);
      if (!current) return Promise.reject(new Error('not_found'));
      const area = {
        ...current,
        x: input.x ?? current.x,
        y: input.y ?? current.y,
        code: input.code ?? current.code,
        content: input.content ?? current.content,
        orientation: input.orientation ?? current.orientation,
        updatedAt: new Date().toISOString(),
      };
      areas = areas.map((a) => (a.id === id ? area : a));
      return Promise.resolve(area);
    },
    remove: (id) => {
      areas = areas.filter((a) => a.id !== id);
      return Promise.resolve();
    },
  };
}
