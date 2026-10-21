import { Text } from "@react-email/components";
import { EmailLayout, rowLabel, rowValue, textStyle } from "./EmailLayout";

interface Props {
  amount: string;
  payoutMethod: string;
  userEmail: string;
  isAdminCopy?: boolean;
}

export function WithdrawalRequestedEmail({ amount, payoutMethod, userEmail, isAdminCopy }: Props) {
  return (
    <EmailLayout
      previewText={`Withdrawal request of ${amount} submitted`}
      heading={isAdminCopy ? "New withdrawal request" : "Withdrawal request received"}
    >
      <Text style={textStyle}>
        {isAdminCopy
          ? `${userEmail} has requested a withdrawal. Review it in the admin panel.`
          : "We've received your withdrawal request and it is now pending review. You'll get another email once it's processed."}
      </Text>
      <Text style={rowLabel}>Amount</Text>
      <Text style={rowValue}>{amount}</Text>
      <Text style={rowLabel}>Payout method</Text>
      <Text style={rowValue}>{payoutMethod}</Text>
      {isAdminCopy && (
        <>
          <Text style={rowLabel}>Requested by</Text>
          <Text style={rowValue}>{userEmail}</Text>
        </>
      )}
    </EmailLayout>
  );
}

export default WithdrawalRequestedEmail;
