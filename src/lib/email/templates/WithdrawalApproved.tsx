import { Text } from "@react-email/components";
import { EmailLayout, rowLabel, rowValue, textStyle } from "./EmailLayout";

interface Props {
  amount: string;
  payoutMethod: string;
  note?: string | null;
}

export function WithdrawalApprovedEmail({ amount, payoutMethod, note }: Props) {
  return (
    <EmailLayout previewText={`Your withdrawal of ${amount} was approved`} heading="Withdrawal approved">
      <Text style={textStyle}>
        Good news — your withdrawal has been processed and completed.
      </Text>
      <Text style={rowLabel}>Amount</Text>
      <Text style={rowValue}>{amount}</Text>
      <Text style={rowLabel}>Payout method</Text>
      <Text style={rowValue}>{payoutMethod}</Text>
      {note && (
        <>
          <Text style={rowLabel}>Note</Text>
          <Text style={rowValue}>{note}</Text>
        </>
      )}
    </EmailLayout>
  );
}

export default WithdrawalApprovedEmail;
