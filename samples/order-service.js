import { randomUUID } from "node:crypto";

class InventoryGateway {
  async reserveItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No items to reserve");
    }

    return {
      reservationId: `res-${randomUUID()}`,
      reservedCount: items.length,
    };
  }
}

class PaymentGateway {
  async charge(customerId, amount) {
    if (!customerId) {
      throw new Error("Missing customer");
    }

    if (amount <= 0) {
      throw new Error("Invalid payment amount");
    }

    return {
      paymentId: `pay-${randomUUID()}`,
      status: "approved",
      chargedAmount: amount,
    };
  }
}

class OrderRepository {
  async save(order) {
    return {
      ...order,
      savedAt: new Date().toISOString(),
    };
  }
}

export class OrderService {
  constructor({
    inventoryGateway = new InventoryGateway(),
    paymentGateway = new PaymentGateway(),
    orderRepository = new OrderRepository(),
  } = {}) {
    this.inventoryGateway = inventoryGateway;
    this.paymentGateway = paymentGateway;
    this.orderRepository = orderRepository;
  }

  calculateTotal(items) {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  async createOrder({ customerId, items }) {
    if (!customerId) {
      throw new Error("customerId is required");
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items are required");
    }

    const total = this.calculateTotal(items);
    const reservation = await this.inventoryGateway.reserveItems(items);
    const payment = await this.paymentGateway.charge(customerId, total);

    const order = {
      id: `ord-${randomUUID()}`,
      customerId,
      items,
      total,
      reservationId: reservation.reservationId,
      paymentId: payment.paymentId,
      status: payment.status === "approved" ? "confirmed" : "pending",
    };

    return this.orderRepository.save(order);
  }
}

export async function runOrderScenario() {
  const service = new OrderService();

  return service.createOrder({
    customerId: "cust-1001",
    items: [
      { sku: "keyboard", price: 120, quantity: 1 },
      { sku: "mouse", price: 45, quantity: 2 },
    ],
  });
}
