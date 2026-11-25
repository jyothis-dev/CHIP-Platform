import { Component } from 'react';
import { Alert, Button } from '@/shared/ui/index.js';
import './ErrorBoundary.css';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="error-boundary">
          <h1>Something went wrong</h1>
          <Alert>The page failed to render. You can reload and continue.</Alert>
          <Button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.assign('/');
            }}
          >
            Go to dashboard
          </Button>
        </section>
      );
    }
    return this.props.children;
  }
}
