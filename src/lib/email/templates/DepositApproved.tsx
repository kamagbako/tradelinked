import { Text } from "@react-email/components";
import { EmailLayout, rowLabel, rowValue, textStyle } from "./EmailLayout";

interface Props {
  amount: string;
}

export function DepositApprovedEmail({ amount }: Props) {
  return (
    <EmailLayout previewText={`Your deposit of ${amount} was approved`} heading="Deposit approved">
      <Text style={textStyle}>
        Good news — your deposit has been verified and credited to your account balance.
      </Text>
      <Text style={rowLabel}>Amount</Text>
      <Text style={rowValue}>{amount}</Text>
    </EmailLayout>
  );
}

export default DepositApprovedEmail;
