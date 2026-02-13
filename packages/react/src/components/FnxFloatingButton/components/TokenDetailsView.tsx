import type { ReactNode } from 'react';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { LuExternalLink } from 'react-icons/lu';

import { cn } from '@/utils/cn';
import type { Token } from '@/types/token';

import { AddressButton } from './AddressButton';
import { Button } from './Button';
import { Card } from './Card';
import { CofheTokenConfidentialBalance } from './CofheTokenConfidentialBalance';
import { HashLink } from './HashLink';
import { MiniAreaChart, type MiniAreaChartPoint } from './MiniAreaChart';
import { TokenIcon } from './TokenIcon';
import { PageContainer } from './PageContainer';

export interface TokenDetailsPrice {
  valueUsd: number;
  changeUsd: number;
  changePct: number;
}

export interface TokenDetailsActivityItem {
  kind: string;
  from: string;
  amountUsd: number;
  amountToken: number;
  leftIcon?: ReactNode;
}

export interface TokenDetailsResources {
  ferc20Address: `0x${string}`;
  website: string;
  whitepaper: string;
}

export interface TokenDetailsViewProps {
  token: Token;
  onBack?: () => void;
  onAddCustomToken?: () => void;
  onViewOnExplorer?: () => void;
  onUnshield?: () => void;
  onSend?: () => void;

  price?: TokenDetailsPrice;
  chartPoints?: MiniAreaChartPoint[];
  chartMarkerLabel?: string;
  activity?: TokenDetailsActivityItem[];
  resources?: TokenDetailsResources;
  disclaimer?: string;
}

const defaultPrice: TokenDetailsPrice = {
  valueUsd: 3330.45,
  changeUsd: 1034.45,
  changePct: 7.32,
};

const defaultChart: MiniAreaChartPoint[] = [
  { x: 0, y: 3100 },
  { x: 1, y: 3150 },
  { x: 2, y: 3125 },
  { x: 3, y: 3200 },
  { x: 4, y: 3250 },
  { x: 5, y: 3180 },
  { x: 6, y: 3300 },
  { x: 7, y: 3330 },
];

const defaultActivity: TokenDetailsActivityItem[] = [
  { kind: 'Received', from: '0xGBDZb25042...', amountUsd: 1000, amountToken: 0.23 },
  { kind: 'Sent', from: '0xGBDZb25042...', amountUsd: 1000, amountToken: 0.23 },
  { kind: 'Claimed', from: '0xGBDZb25042...', amountUsd: 1000, amountToken: 0.23 },
];

const defaultDisclaimer =
  'This is a Dual fERC20/eERC20 token. It natively works with shielding and encrypted transfer.';

const money = (n: number) =>
  n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const TokenDetailsView: React.FC<TokenDetailsViewProps> = ({
  token,
  onBack,
  onAddCustomToken,
  onViewOnExplorer,
  onUnshield,
  onSend,
  price = defaultPrice,
  chartPoints = defaultChart,
  chartMarkerLabel = '$3650',
  activity = defaultActivity,
  resources = {
    ferc20Address: token.address,
    website: 'https://example.com',
    whitepaper: 'https://example.com/whitepaper.pdf',
  },
  disclaimer = defaultDisclaimer,
}) => {
  const openExternal = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <PageContainer
      header={
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm hover:opacity-80 transition-opacity"
          >
            <ArrowBackIcon style={{ fontSize: 16 }} />
            <div className="flex flex-col leading-tight">
              <p className="text-sm font-medium">Tokens list</p>
              <p className="text-xxxs opacity-70">{token.name}</p>
            </div>
          </button>

          <Button
            variant="outline"
            size="sm"
            label="Add custom Token +"
            onClick={onAddCustomToken}
            disabled={!onAddCustomToken}
          />
        </div>
      }
      content={
        <>
          {/* Token summary */}
          <Card className="p-3" padded={false}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TokenIcon logoURI={token.logoURI} alt={token.name} size="md" />
                <div className="flex flex-col leading-tight">
                  <p className="text-sm font-bold fnx-text-primary">{token.symbol}</p>
                  <p className="text-xxxs opacity-70">{token.name}</p>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <CofheTokenConfidentialBalance token={token} size="lg" decimalPrecision={5} className="font-bold" />
                <p className="text-xxxs opacity-60">{money(price.valueUsd)}</p>
              </div>
            </div>
          </Card>

          {/* Price + chart */}
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold fnx-text-primary">{money(price.valueUsd)}</p>
                <p className="text-sm fnx-text-primary opacity-70">
                  <span className="mr-2">+ {money(price.changeUsd)}</span>
                  <span>({price.changePct.toFixed(2)}%)</span>
                </p>
              </div>
              <div className="text-xxxs opacity-60">dummy chart</div>
            </div>

            <Card className="p-3" padded={false}>
              <MiniAreaChart points={chartPoints} markerLabel={chartMarkerLabel} />
              <div className="flex items-center justify-between text-xxxs opacity-60 mt-1">
                <span>15:00</span>
                <span>16:00</span>
                <span>17:00</span>
              </div>
            </Card>
          </div>

          {/* Activity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold fnx-text-primary">Activity</h3>
              <Button
                variant="outline"
                size="sm"
                label="view on explorer"
                onClick={onViewOnExplorer}
                disabled={!onViewOnExplorer}
              />
            </div>

            <Card className="p-3" padded={false}>
              <div className="flex flex-col gap-3">
                {activity.map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {item.leftIcon ?? (
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full',
                            'bg-cyan-200/70 dark:bg-cyan-900/40',
                            'flex items-center justify-center'
                          )}
                        />
                      )}
                      <div className="flex flex-col">
                        <p className="text-sm font-bold fnx-text-primary">{item.kind}</p>
                        <p className="text-xxxs opacity-70">from: {item.from}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <p className="text-sm font-bold fnx-text-primary">{money(item.amountUsd)}</p>
                      <p className="text-xxxs opacity-70">
                        {item.amountToken} {token.symbol}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Resources */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold fnx-text-primary">Resources</h3>
            <Card className="p-3" padded={false}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xxxs opacity-70">fERC20 Address</p>
                  <HashLink type="token" hash={resources.ferc20Address} chainId={token.chainId} extraShort />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xxxs opacity-70">Website</p>
                  <button
                    type="button"
                    onClick={() => openExternal(resources.website)}
                    className="flex items-center gap-1.5 text-xs fnx-text-primary opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <span className="truncate max-w-[180px]">{resources.website}</span>
                    <LuExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xxxs opacity-70">Whitepaper</p>
                  <button
                    type="button"
                    onClick={() => openExternal(resources.whitepaper)}
                    className="flex items-center gap-1.5 text-xs fnx-text-primary opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <span className="truncate max-w-[180px]">{resources.whitepaper}</span>
                    <LuExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>

            <p className="text-xxxs opacity-70">{disclaimer}</p>
          </div>

          {/* Token Details */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold fnx-text-primary">Token Details</h3>

            <Card className="p-3" padded={false}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <p className="text-xxxs opacity-70">Contract Address</p>
                  <AddressButton address={token.address} className="w-full justify-start" />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xxxs opacity-70">Decimals</p>
                  <p className="text-sm font-medium">{token.decimals}</p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xxxs opacity-70">Confidentiality Type</p>
                  <p className="text-sm font-medium capitalize">{token.extensions.fhenix.confidentialityType}</p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xxxs opacity-70">Value Type</p>
                  <p className="text-sm font-medium">{token.extensions.fhenix.confidentialValueType}</p>
                </div>
              </div>
            </Card>
          </div>
        </>
      }
      footer={
        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" label="Unshield" onClick={onUnshield} disabled={!onUnshield} />
          <Button variant="outline" className="flex-1" label="Send" onClick={onSend} disabled={!onSend} />
        </div>
      }
    />
  );
};
