import { Button } from './Button.jsx';
import './Pagination.css';

export const PAGE_SIZE = 20;

export function Pagination({ page, pageSize, total, onPageChange, disabled = false }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="pager">
      <p className="muted pager-status">
        {total === 0 ? 'No rows' : `${start}–${end} of ${total}`}
      </p>
      <div className="pager-controls">
        <Button
          variant="ghost"
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="pager-page">Page {Math.min(page, totalPages)} of {totalPages}</span>
        <Button
          variant="ghost"
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
