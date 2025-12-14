/**
 * CSV Export Utility
 */

export function exportPaymentsToCSV(payments: any[]) {
  const headers = [
    "ID",
    "Amount",
    "Currency",
    "Status",
    "Payer Wallet",
    "Merchant Wallet",
    "Transaction Hash",
    "Created At",
    "Updated At",
  ];

  const rows = payments.map((payment) => [
    payment.id,
    payment.amount,
    payment.currency,
    payment.status,
    payment.payerWallet || "",
    payment.merchantWallet || "",
    payment.txHash || "",
    new Date(payment.createdAt).toISOString(),
    new Date(payment.updatedAt).toISOString(),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `payments-${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

