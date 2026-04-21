import java.time.Instant;
import java.util.List;
import java.util.UUID;

class InventoryGateway {
  public Reservation reserveItems(List<OrderItem> items) {
    if (items == null || items.isEmpty()) {
      throw new IllegalArgumentException("No items to reserve");
    }

    return new Reservation("res-" + UUID.randomUUID(), items.size());
  }
}

class PaymentGateway {
  public Payment charge(String customerId, double amount) {
    if (customerId == null || customerId.isBlank()) {
      throw new IllegalArgumentException("Missing customer");
    }

    if (amount <= 0) {
      throw new IllegalArgumentException("Invalid amount");
    }

    return new Payment("pay-" + UUID.randomUUID(), "APPROVED", amount);
  }
}

class OrderRepository {
  public Order save(Order order) {
    order.setSavedAt(Instant.now().toString());
    return order;
  }
}

class OrderItem {
  private final String sku;
  private final double price;
  private final int quantity;

  public OrderItem(String sku, double price, int quantity) {
    this.sku = sku;
    this.price = price;
    this.quantity = quantity;
  }

  public String getSku() {
    return sku;
  }

  public double getPrice() {
    return price;
  }

  public int getQuantity() {
    return quantity;
  }

  public double getSubtotal() {
    return price * quantity;
  }
}

class Reservation {
  private final String reservationId;
  private final int reservedCount;

  public Reservation(String reservationId, int reservedCount) {
    this.reservationId = reservationId;
    this.reservedCount = reservedCount;
  }

  public String getReservationId() {
    return reservationId;
  }

  public int getReservedCount() {
    return reservedCount;
  }
}

class Payment {
  private final String paymentId;
  private final String status;
  private final double chargedAmount;

  public Payment(String paymentId, String status, double chargedAmount) {
    this.paymentId = paymentId;
    this.status = status;
    this.chargedAmount = chargedAmount;
  }

  public String getPaymentId() {
    return paymentId;
  }

  public String getStatus() {
    return status;
  }

  public double getChargedAmount() {
    return chargedAmount;
  }
}

class Order {
  private final String id;
  private final String customerId;
  private final List<OrderItem> items;
  private final double total;
  private final String reservationId;
  private final String paymentId;
  private final String status;
  private String savedAt;

  public Order(
      String id,
      String customerId,
      List<OrderItem> items,
      double total,
      String reservationId,
      String paymentId,
      String status) {
    this.id = id;
    this.customerId = customerId;
    this.items = items;
    this.total = total;
    this.reservationId = reservationId;
    this.paymentId = paymentId;
    this.status = status;
  }

  public String getId() {
    return id;
  }

  public String getCustomerId() {
    return customerId;
  }

  public List<OrderItem> getItems() {
    return items;
  }

  public double getTotal() {
    return total;
  }

  public String getReservationId() {
    return reservationId;
  }

  public String getPaymentId() {
    return paymentId;
  }

  public String getStatus() {
    return status;
  }

  public String getSavedAt() {
    return savedAt;
  }

  public void setSavedAt(String savedAt) {
    this.savedAt = savedAt;
  }
}

public class OrderService {
  private final InventoryGateway inventoryGateway;
  private final PaymentGateway paymentGateway;
  private final OrderRepository orderRepository;

  public OrderService() {
    this.inventoryGateway = new InventoryGateway();
    this.paymentGateway = new PaymentGateway();
    this.orderRepository = new OrderRepository();
  }

  public double calculateTotal(List<OrderItem> items) {
    double total = 0;
    for (OrderItem item : items) {
      total += item.getSubtotal();
    }
    return total;
  }

  public Order createOrder(String customerId, List<OrderItem> items) {
    if (customerId == null || customerId.isBlank()) {
      throw new IllegalArgumentException("customerId is required");
    }

    if (items == null || items.isEmpty()) {
      throw new IllegalArgumentException("items are required");
    }

    double total = calculateTotal(items);
    Reservation reservation = inventoryGateway.reserveItems(items);
    Payment payment = paymentGateway.charge(customerId, total);

    Order order = new Order(
        "ord-" + UUID.randomUUID(),
        customerId,
        items,
        total,
        reservation.getReservationId(),
        payment.getPaymentId(),
        "APPROVED".equals(payment.getStatus()) ? "CONFIRMED" : "PENDING");

    return orderRepository.save(order);
  }

  public static void main(String[] args) {
    OrderService service = new OrderService();
    service.createOrder(
        "cust-1001",
        List.of(
            new OrderItem("keyboard", 120.0, 1),
            new OrderItem("mouse", 45.0, 2)));
  }
}
