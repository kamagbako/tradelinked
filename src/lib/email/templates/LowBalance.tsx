import { Text } from "@react-email/components";
import { EmailLayout, rowLabel, rowValue, textStyle } from "./EmailLayout";

interface Props {
  balance: string;
  threshold: string;
}

export function LowBalanceEmail({ balance, threshold }: Props) {
  return (
    <EmailLayout previewText={`Your balance has dropped below ${threshold}`} heading="Your balance is low">
      <Text style={textStyle}>
        Your available balance has dropped below your account&apos;s alert threshold. Make a deposit to
        keep your plan active and avoid any interruption.
      </Text>
      <Text style={rowLabel}>Current balance</Text>
      <Text style={rowValue}>{balance}</Text>
      <Text style={rowLabel}>Alert threshold</Text>
      <Text style={rowValue}>{threshold}</Text>
    </EmailLayout>
  );
}

export default LowBalanceEmail;
