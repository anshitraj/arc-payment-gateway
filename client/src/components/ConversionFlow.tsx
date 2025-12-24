/**
 * Conversion Flow Component
 * Displays transparent conversion path for multi-asset payments
 */

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ConversionFlowProps {
  paymentAsset: string;
  settlementCurrency: "USDC" | "EURC";
  amount: string;
  isTestnet: boolean;
}

interface ConversionEstimate {
  estimatedTime: number;
  estimatedFees: string;
  conversionPath: string;
  steps: string[];
}

export function ConversionFlow({
  paymentAsset,
  settlementCurrency,
  amount,
  isTestnet,
}: ConversionFlowProps) {
  // Fetch conversion estimate from backend
  const { data: estimate, isLoading } = useQuery<ConversionEstimate>({
    queryKey: ["/api/payments/conversion-estimate", paymentAsset, settlementCurrency, amount, isTestnet],
    queryFn: async () => {
      const params = new URLSearchParams({
        paymentAsset,
        settlementCurrency,
        amount,
        isTestnet: String(isTestnet),
      });
      const response = await fetch(`/api/payments/conversion-estimate?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch conversion estimate: ${response.statusText}`);
      }
      return await response.json();
    },
    enabled: !!paymentAsset && !!settlementCurrency && !!amount && parseFloat(amount) > 0,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground">Calculating conversion path...</div>
        </CardContent>
      </Card>
    );
  }

  if (!estimate) {
    return null;
  }

  const [asset, chain] = paymentAsset.split("_");
  const requiresSwap = asset !== settlementCurrency;
  const requiresBridge = chain !== "ARC";

  return (
    <Card className="bg-muted/50 border-border">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Conversion Path</span>
            {isTestnet && (
              <Badge variant="secondary" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Testnet Mode
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{asset}</Badge>
            <span className="text-muted-foreground">on</span>
            <Badge variant="outline">{chain === "ARC" ? "Arc Network" : chain.replace("_", " ")}</Badge>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            {requiresSwap && (
              <>
                <Badge variant="outline">{settlementCurrency}</Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </>
            )}
            {requiresBridge && (
              <>
                <span className="text-muted-foreground">Bridge</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </>
            )}
            <Badge variant="default">{settlementCurrency} on Arc</Badge>
          </div>

          {estimate.steps && estimate.steps.length > 0 && (
            <div className="space-y-1 pl-2 border-l-2 border-border">
              {estimate.steps.map((step, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  {index + 1}. {step}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Estimated time:</span>
            <span className="font-medium">{estimate.estimatedTime}s</span>
          </div>
          {parseFloat(estimate.estimatedFees) > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">Fees: </span>
              <span className="font-medium">{estimate.estimatedFees} {settlementCurrency}</span>
            </div>
          )}
        </div>

        {isTestnet && (
          <div className="text-xs text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            ⚠ Testnet Mode — Conversions are simulated. Settlement logic mirrors production.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

