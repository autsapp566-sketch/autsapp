export function serializeLead(lead) {
  return {
    id: lead.id,
    phone: lead.phone,
    name: lead.name,
    status: lead.status,
    aiPaused: Boolean(lead.aiPaused) || lead.status === 'HANDED_OFF',
    qualificationScore: lead.qualificationScore,
    summary: lead.summary,
    assignedToId: lead.assignedToId,
    instanceId: lead.instanceId ?? null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

export function serializeMessage(message) {
  return {
    id: message.id,
    leadId: message.leadId,
    instanceId: message.instanceId ?? null,
    sender: message.sender,
    content: message.content,
    createdAt: message.createdAt,
  };
}
