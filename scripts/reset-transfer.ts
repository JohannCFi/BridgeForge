import prisma from "../src/db/client.js";

const id = process.argv[2];
if (!id) { console.error("Usage: npx tsx scripts/reset-transfer.ts <transfer-id>"); process.exit(1); }

await prisma.transfer.update({ where: { id }, data: { status: "ready", burnTxHash: null, burnConfirmedAt: null, attestation: null, messageHash: null } });
const t = await prisma.transfer.findUnique({ where: { id } });
console.log("Reset done. Status:", t?.status);
await prisma.$disconnect();
