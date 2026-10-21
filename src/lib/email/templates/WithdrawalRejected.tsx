import { Text } from "@react-email/components";
import { EmailLayout, rowLabel, rowValue, textStyle } from "./EmailLayout";

interface Props {
  amount: string;
  reason: string;
  supportUrl: string;
}

export function WithdrawalRejectedEmail({ amount, reason, supportUrl }: Props) {
  return (
    <EmailLayout previewText={`Your withdrawal of ${amount} was rejected`} heading="Withdrawal rejected">
      <Text style={textStyle}>
        Your withdrawal request could not be processed. Details are below — if you have
        questions, our support team is happy to help.
      </Text>
      <Text style={rowLabel}>Amount</Text>
      <Text style={rowValue}>{amount}</Text>
      <Text style={rowLabel}>Reason</Text>
      <Text style={rowValue}>{reason}</Text>
      <Text style={textStyle}>
        Contact support: <a href={supportUrl} style={{ color: "#3b82f6" }}>{supportUrl}</a>
      </Text>
    </EmailLayout>
  );
}

export default WithdrawalRejectedEmail;
