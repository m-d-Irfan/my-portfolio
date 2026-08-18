/**
 * useForm — form state, validation, and server error wiring.
 *
 * Copy to `src/hooks/useForm.js`.
 *
 *   const form = useForm({
 *     initialValues: { email: "", quantity: 1 },
 *     rules: orderItemRules,
 *     onSubmit: async (values) => api.post("/api/orders/", values),
 *   });
 *
 * Deliberately small. It does not own layout, styling, or field components —
 * only the state machine and the error wiring that is easy to get wrong.
 *
 * What it will NOT do: validate anything the server does not also validate.
 * Client rules are UX. Audit finding S5 was a client-computed total the server
 * believed. See references/01-validation-layers.md.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useForm({ initialValues, rules = {}, onSubmit, context = {} }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Incremented on every submit attempt. Consumers depend on this to replay
  // the error shake when a SECOND identical failure leaves `errors` unchanged.
  const [submitCount, setSubmitCount] = useState(0);

  const firstErrorRef = useRef(null);

  const validateField = useCallback(
    (name, value) => {
      const rule = rules[name];
      return rule ? rule(value, { ...context, values }) : null;
    },
    [rules, context, values]
  );

  const validateAll = useCallback(() => {
    const next = {};
    for (const name of Object.keys(rules)) {
      const message = validateField(name, values[name]);
      if (message) next[name] = message;
    }
    return next;
  }, [rules, values, validateField]);

  const handleChange = useCallback(
    (event) => {
      const { name, value, type, checked, files } = event.target;
      const nextValue =
        type === "checkbox" ? checked : type === "file" ? files[0] : value;

      setValues((prev) => ({ ...prev, [name]: nextValue }));

      // Re-validate live ONLY for a field already showing an error, so a
      // correction clears immediately. Validating from the first keystroke
      // shows "Enter a valid email" while someone types the `i` of `ifti@`.
      setErrors((prev) => {
        if (!prev[name]) return prev;
        const message = validateField(name, nextValue);
        if (message) return { ...prev, [name]: message };
        const { [name]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [validateField]
  );

  const handleBlur = useCallback(
    (event) => {
      const { name } = event.target;
      setTouched((prev) => ({ ...prev, [name]: true }));
      const message = validateField(name, values[name]);
      setErrors((prev) => {
        if (message) return { ...prev, [name]: message };
        const { [name]: _removed, ...rest } = prev;
        return rest;
      });
    },
    [validateField, values]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event?.preventDefault();
      if (submitting) return; // UX guard only — duplicate ORDERS need an
                              // idempotency key server-side, see data-layer.

      setSubmitCount((n) => n + 1);

      const clientErrors = validateAll();
      if (Object.keys(clientErrors).length) {
        setErrors(clientErrors);
        setTouched(
          Object.fromEntries(Object.keys(rules).map((name) => [name, true]))
        );
        return;
      }

      setSubmitting(true);
      setErrors({});

      try {
        const result = await onSubmit(values);
        // Reflect any server normalisation (phone digits, lowercased email)
        // back into the form, or the display disagrees with what was stored.
        if (result?.data && typeof result.data === "object") {
          setValues((prev) => ({ ...prev, ...pickKnown(prev, result.data) }));
        }
        return result;
      } catch (err) {
        // The envelope from api-contract: {code, message, fields}.
        const normalized = err?.normalized;
        if (normalized?.fields && Object.keys(normalized.fields).length) {
          setErrors(normalized.fields);
        } else if (normalized?.message) {
          setErrors({ _form: normalized.message });
        } else {
          setErrors({ _form: "Something went wrong. Please try again." });
        }
        // Values are NOT cleared. Retyping a long form because one field was
        // wrong is the fastest way to lose a sale.
        throw err;
      } finally {
        // Always. Setting this only on success leaves the form permanently
        // disabled after one failure.
        setSubmitting(false);
      }
    },
    [submitting, validateAll, rules, onSubmit, values]
  );

  // Move focus to the first invalid field. On a long form an error above the
  // fold is invisible after submitting from the bottom, and keyboard users
  // have no way to find it at all. focus() scrolls AND moves the cursor, which
  // is what a screen reader announces — scrollIntoView() does neither.
  useEffect(() => {
    if (Object.keys(errors).length) firstErrorRef.current?.focus();
  }, [errors, submitCount]);

  const fieldProps = useCallback(
    (name) => {
      const hasError = Boolean(errors[name]);
      const isFirstError = hasError && Object.keys(errors)[0] === name;
      return {
        name,
        value: values[name] ?? "",
        onChange: handleChange,
        onBlur: handleBlur,
        "aria-invalid": hasError || undefined,
        // undefined, not a dangling id, when there is no message.
        "aria-describedby": hasError ? `${name}-error` : undefined,
        ref: isFirstError ? firstErrorRef : undefined,
      };
    },
    [values, errors, handleChange, handleBlur]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setSubmitCount(0);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    submitting,
    submitCount,
    firstErrorRef,
    handleChange,
    handleBlur,
    handleSubmit,
    fieldProps,
    reset,
    setValues,
    setErrors,
    isValid: Object.keys(errors).length === 0,
  };
}

/** Only take back keys the form already knows about. */
function pickKnown(shape, data) {
  return Object.fromEntries(
    Object.keys(shape)
      .filter((key) => key in data)
      .map((key) => [key, data[key]])
  );
}

/**
 * Replay the error shake from transitions-dev.
 *
 * `.is-error` (treatment) and `.is-shaking` (animation) are deliberately
 * separate classes so the shake can replay without the error state flickering
 * off and on in the same tick.
 *
 * The forced reflow is what makes a second identical failure animate at all —
 * without it the browser coalesces the remove and add, and nothing happens.
 *
 * See transitions-dev/12-error-state-shake.md.
 */
export function shakeElement(element) {
  if (!element) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  element.classList.remove("is-shaking");
  void element.offsetWidth; // forced reflow
  element.classList.add("is-shaking");
}

/**
 * Shake the first invalid field on every failed submit.
 *
 *   useErrorShake(form.errors, form.submitCount, form.firstErrorRef);
 *
 * submitCount is in the deps deliberately: submitting twice with the same
 * error leaves `errors` referentially unchanged, so without it the effect does
 * not re-run and the second rejection is silent.
 */
export function useErrorShake(errors, submitCount, ref) {
  useEffect(() => {
    if (!Object.keys(errors).length) return;
    shakeElement(ref.current?.closest(".t-input"));
  }, [errors, submitCount, ref]);
}
