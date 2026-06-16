import { Loader2 } from "lucide-react";
import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

export type RunningNumberFormValues = {
  prefix: string;
  nextCounter: string;
  suffix?: string;
};

interface RunningNumberSettingsCardProps {
  moduleName: string;
  preview: string;
  form: UseFormReturn<RunningNumberFormValues>;
  onSubmit: (data: RunningNumberFormValues) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  showSaveButton?: boolean;
  embedded?: boolean;
}

const monoInputClass =
  "font-mono text-sm h-10 rounded-md border border-gray-200 bg-white shadow-none focus-visible:ring-1 focus-visible:ring-gray-300";

export function RunningNumberSettingsCard({
  moduleName,
  preview,
  form,
  onSubmit,
  isLoading,
  isSaving,
  showSaveButton = false,
  embedded = false,
}: RunningNumberSettingsCardProps) {
  if (isLoading) {
    return (
      <div className={embedded ? "flex items-center justify-center py-16" : "flex items-center justify-center rounded-lg border border-gray-200 bg-white py-16"}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={embedded ? "rounded-lg border border-gray-200 bg-white" : "rounded-lg border border-gray-200 bg-white"}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <h3 className="text-base font-semibold text-gray-900">{moduleName}</h3>
              <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 px-3 py-1.5 text-sm font-mono text-slate-800">
                Next: {preview || "—"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <label className="text-sm font-normal text-gray-700">Prefix</label>
                    <FormControl>
                      <Input className={monoInputClass} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextCounter"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <label className="text-sm font-normal text-gray-700">Next Counter</label>
                    <FormControl>
                      <NumberInput
                        className={monoInputClass}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="suffix"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <label className="text-sm font-normal text-gray-700">Suffix</label>
                    <FormControl>
                      <Input
                        className={`${monoInputClass} placeholder:font-mono placeholder:text-gray-400`}
                        placeholder="optional"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showSaveButton && (
              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
