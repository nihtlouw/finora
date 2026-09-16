-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_expenseId_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_projectId_fkey";

-- DropIndex
DROP INDEX "Expense_workspaceId_allocationType_idx";

-- DropIndex
DROP INDEX "Expense_workspaceId_expenseDate_idx";

-- DropIndex
DROP INDEX "Expense_workspaceId_status_idx";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "allocationType",
DROP COLUMN "description",
DROP COLUMN "paymentMethod",
DROP COLUMN "receiptUrl",
DROP COLUMN "workspaceId";

-- DropTable
DROP TABLE "ExpenseAllocation";

