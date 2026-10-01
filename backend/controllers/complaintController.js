const complaints = [
  {
    id: "APSRTC-GRV-000001",
    busId: "415",
    passengerName: "Ramesh K.",
    category: "Overcrowding",
    description: "Heavy crowd at Ananthagiri junction during morning peak hours.",
    status: "INVESTIGATING",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: "APSRTC-GRV-000002",
    busId: "302",
    passengerName: "Lakshmi P.",
    category: "Delay",
    description: "Bus departed Paderu 10 minutes behind schedule.",
    status: "RESOLVED",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

exports.create = (req, res) => {
  const { busId, category, description, passengerName = "Demo Passenger" } = req.body;

  if (!busId || !category || !description) {
    return res.status(400).json({
      error: "busId, category and description are required"
    });
  }

  const complaint = {
    id: `APSRTC-GRV-${String(complaints.length + 1).padStart(6, "0")}`,
    busId: String(busId),
    passengerName,
    category,
    description,
    status: "SUBMITTED",
    createdAt: new Date().toISOString()
  };

  complaints.unshift(complaint);
  res.status(201).json(complaint);
};

exports.list = (_req, res) => {
  res.json({ complaints, total: complaints.length });
};

exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const item = complaints.find(c => c.id === id);
  if (!item) return res.status(404).json({ error: "Complaint not found" });

  item.status = status || item.status;
  item.updatedAt = new Date().toISOString();
  res.json({ message: "Status updated", complaint: item });
};
