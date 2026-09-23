import '@testing-library/jest-dom/vitest';

// JSDOM has no layout scrolling; custom listboxes still exercise the DOM call.
import { vi } from 'vitest';
Element.prototype.scrollIntoView = vi.fn();
