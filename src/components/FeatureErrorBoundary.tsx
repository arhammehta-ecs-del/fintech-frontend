import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type FeatureErrorBoundaryProps = {
  featureName: string;
  children: ReactNode;
};

type FeatureErrorBoundaryState = {
  hasError: boolean;
};

export class FeatureErrorBoundary extends Component<FeatureErrorBoundaryProps, FeatureErrorBoundaryState> {
  state: FeatureErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FeatureErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[FeatureErrorBoundary:${this.props.featureName}]`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 text-sm text-rose-700 shadow-sm">
        <p className="text-base font-semibold text-rose-800">Something went wrong in {this.props.featureName}</p>
        <p className="mt-1">Please retry this section. If it keeps happening, refresh the page.</p>
        <Button className="mt-4" variant="outline" onClick={this.handleRetry}>
          Retry section
        </Button>
      </div>
    );
  }
}
