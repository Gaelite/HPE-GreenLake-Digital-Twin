'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DetectionRule, Severity, MetricType } from '@/types';

// ----- Severity badge styles -----
const SEVERITY_BADGE: Record<Severity, string> = {
  info: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  warning: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
  critical: 'bg-red-100 text-red-800 ring-red-600/20',
};

// ----- Metric labels -----
const METRIC_LABELS: Record<string, string> = {
  speed: 'Speed',
  engine_temp: 'Engine Temperature',
  fuel_level: 'Fuel Level',
  tire_pressure: 'Tire Pressure',
  battery_voltage: 'Battery Voltage',
  rpm: 'RPM',
  oil_pressure: 'Oil Pressure',
  odometer: 'Odometer',
};

const METRIC_OPTIONS: MetricType[] = [
  'speed',
  'engine_temp',
  'fuel_level',
  'tire_pressure',
  'battery_voltage',
  'rpm',
  'oil_pressure',
  'odometer',
];

const SEVERITY_OPTIONS: Severity[] = ['info', 'warning', 'critical'];

interface EditingState {
  ruleId: string;
  field: string;
  value: string;
}

/**
 * DetectionRulesTable -- Admin table for managing detection rules.
 * Shows all rules with inline editing, toggle active/inactive, edit thresholds.
 */
export default function DetectionRulesTable() {
  const [rules, setRules] = useState<DetectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // ----- New rule form state -----
  const [newRule, setNewRule] = useState({
    metric_type: 'engine_temp' as MetricType,
    min_value: '',
    max_value: '',
    severity: 'warning' as Severity,
    description: '',
  });

  // ----- Fetch rules -----
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/detection-rules');
      if (!res.ok) throw new Error('Failed to fetch rules');
      const { data } = await res.json();
      setRules(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ----- Toggle rule active/inactive -----
  const toggleActive = async (rule: DetectionRule) => {
    setSavingId(rule.id);
    try {
      const res = await fetch('/api/detection-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          is_active: !rule.is_active,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to toggle rule:', err);
        return;
      }

      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id ? { ...r, is_active: !r.is_active } : r
        )
      );
    } catch (err) {
      console.error('Error toggling rule:', err);
    } finally {
      setSavingId(null);
    }
  };

  // ----- Save inline edit -----
  const saveEdit = async () => {
    if (!editing) return;

    setSavingId(editing.ruleId);
    const updateData: Record<string, unknown> = { id: editing.ruleId };

    // Parse the value based on field type
    if (editing.field === 'min_value' || editing.field === 'max_value') {
      updateData[editing.field] = editing.value === '' ? null : parseFloat(editing.value);
    } else if (editing.field === 'severity') {
      updateData[editing.field] = editing.value;
    } else if (editing.field === 'description') {
      updateData[editing.field] = editing.value;
    }

    try {
      const res = await fetch('/api/detection-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to update rule:', err);
        return;
      }

      const { data } = await res.json();
      setRules((prev) =>
        prev.map((r) => (r.id === data.id ? data : r))
      );
      setEditing(null);
    } catch (err) {
      console.error('Error updating rule:', err);
    } finally {
      setSavingId(null);
    }
  };

  // ----- Add new rule -----
  const addRule = async () => {
    if (!newRule.description || !newRule.metric_type) return;

    setSavingId('new');
    try {
      const res = await fetch('/api/detection-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric_type: newRule.metric_type,
          min_value: newRule.min_value === '' ? null : parseFloat(newRule.min_value),
          max_value: newRule.max_value === '' ? null : parseFloat(newRule.max_value),
          severity: newRule.severity,
          description: newRule.description,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to create rule:', err);
        return;
      }

      const { data } = await res.json();
      setRules((prev) => [...prev, data]);
      setShowAddForm(false);
      setNewRule({
        metric_type: 'engine_temp',
        min_value: '',
        max_value: '',
        severity: 'warning',
        description: '',
      });
    } catch (err) {
      console.error('Error creating rule:', err);
    } finally {
      setSavingId(null);
    }
  };

  // ----- Handle keyboard events for inline editing -----
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') setEditing(null);
  };

  // ----- Render editable cell -----
  const renderEditableCell = (
    rule: DetectionRule,
    field: string,
    value: string | number | null,
    displayValue: string
  ) => {
    const isEditing = editing?.ruleId === rule.id && editing?.field === field;

    if (isEditing) {
      if (field === 'severity') {
        return (
          <select
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={saveEdit}
            onKeyDown={handleEditKeyDown}
            autoFocus
            className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        );
      }

      return (
        <input
          type={field === 'description' ? 'text' : 'number'}
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={saveEdit}
          onKeyDown={handleEditKeyDown}
          autoFocus
          step={field === 'min_value' || field === 'max_value' ? '0.1' : undefined}
          className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      );
    }

    return (
      <button
        type="button"
        onClick={() =>
          setEditing({
            ruleId: rule.id,
            field,
            value: value !== null && value !== undefined ? String(value) : '',
          })
        }
        className="w-full rounded px-2 py-1 text-left text-sm hover:bg-blue-50"
        title="Click to edit"
      >
        {displayValue}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="h-8 w-8 animate-spin text-blue-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="ml-3 text-sm text-gray-500">Loading detection rules...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={fetchRules}
          className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Detection Rules</h2>
          <p className="text-sm text-gray-500">{rules.length} rules configured</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Rule
        </button>
      </div>

      {/* Add Rule Form */}
      {showAddForm && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-blue-900">New Detection Rule</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Metric</label>
              <select
                value={newRule.metric_type}
                onChange={(e) => setNewRule({ ...newRule, metric_type: e.target.value as MetricType })}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m} value={m}>{METRIC_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Min Value</label>
              <input
                type="number"
                step="0.1"
                value={newRule.min_value}
                onChange={(e) => setNewRule({ ...newRule, min_value: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Max Value</label>
              <input
                type="number"
                step="0.1"
                value={newRule.max_value}
                onChange={(e) => setNewRule({ ...newRule, max_value: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Severity</label>
              <select
                value={newRule.severity}
                onChange={(e) => setNewRule({ ...newRule, severity: e.target.value as Severity })}
                className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                placeholder="Rule description"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addRule}
              disabled={!newRule.description || savingId === 'new'}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingId === 'new' ? (
                <svg className="mr-1.5 h-3 w-3 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Create Rule
            </button>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Active
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Metric
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Vehicle Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Min Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Max Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Severity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`transition-colors hover:bg-gray-50 ${
                    !rule.is_active ? 'opacity-50' : ''
                  }`}
                >
                  {/* Active Toggle */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(rule)}
                      disabled={savingId === rule.id}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        rule.is_active ? 'bg-blue-600' : 'bg-gray-200'
                      } ${savingId === rule.id ? 'cursor-not-allowed' : ''}`}
                      role="switch"
                      aria-checked={rule.is_active}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                          rule.is_active ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>

                  {/* Metric */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {METRIC_LABELS[rule.metric_type] || rule.metric_type}
                  </td>

                  {/* Vehicle Type */}
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {rule.vehicle_type
                      ? rule.vehicle_type.charAt(0).toUpperCase() + rule.vehicle_type.slice(1).replace('_', ' ')
                      : 'All'}
                  </td>

                  {/* Min Value (editable) */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {renderEditableCell(
                      rule,
                      'min_value',
                      rule.min_value,
                      rule.min_value !== null ? String(rule.min_value) : '-'
                    )}
                  </td>

                  {/* Max Value (editable) */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {renderEditableCell(
                      rule,
                      'max_value',
                      rule.max_value,
                      rule.max_value !== null ? String(rule.max_value) : '-'
                    )}
                  </td>

                  {/* Severity (editable) */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {editing?.ruleId === rule.id && editing?.field === 'severity' ? (
                      renderEditableCell(rule, 'severity', rule.severity, rule.severity)
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            ruleId: rule.id,
                            field: 'severity',
                            value: rule.severity,
                          })
                        }
                        className="rounded-full hover:opacity-75"
                        title="Click to edit severity"
                      >
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${SEVERITY_BADGE[rule.severity]}`}
                        >
                          {rule.severity.charAt(0).toUpperCase() + rule.severity.slice(1)}
                        </span>
                      </button>
                    )}
                  </td>

                  {/* Description (editable) */}
                  <td className="max-w-xs truncate px-4 py-3">
                    {renderEditableCell(
                      rule,
                      'description',
                      rule.description,
                      rule.description
                    )}
                  </td>
                </tr>
              ))}

              {rules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                    No detection rules configured. Click &quot;Add Rule&quot; to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
