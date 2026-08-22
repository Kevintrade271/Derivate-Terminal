import { useState, useEffect } from 'react';
import { fetchHistory, triggerHistoryUpdate } from '../api/client';
import { Card, Title, BarChart, LineChart, Text, Metric, Flex, Button } from '@tremor/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function History({ ticker }) {
  const queryClient = useQueryClient();

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['history', ticker],
    queryFn: () => fetchHistory(ticker),
    refetchInterval: 300000,
  });

  const mutation = useMutation({
    mutationFn: () => triggerHistoryUpdate(ticker),
    onSuccess: () => {
      // Wait a bit for backend processing
      setTimeout(() => queryClient.invalidateQueries(['history', ticker]), 3000);
    }
  });

  if (isError) {
    return <div className="error-msg">Error cargando historial.</div>;
  }

  return (
    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', overflowY: 'auto', paddingRight: '12px' }}>
      <Card decoration="top" decorationColor="blue">
        <Flex alignItems="start">
          <div>
            <Title>Historial de Sesiones: {ticker}</Title>
            <Text>Desarrollo diario de GEX, DEX y Open Interest</Text>
          </div>
          <Button
            size="sm"
            loading={mutation.isPending || isLoading}
            onClick={() => mutation.mutate()}
          >
            Guardar Sesión
          </Button>
        </Flex>
      </Card>

      {!data || data.length === 0 ? (
        <Card className="text-center p-8">
          <Text>No hay datos históricos registrados aún para {ticker}. Haz clic en "Guardar Sesión" para comenzar el registro.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Title>Total GEX (Billions)</Title>
            <BarChart
              className="mt-6 h-72"
              data={data}
              index="date"
              categories={["total_gex", "total_gex_0dte"]}
              colors={["blue", "teal"]}
              yAxisWidth={48}
              valueFormatter={(number) => Intl.NumberFormat("en-US").format(number)}
            />
          </Card>

          <Card>
            <Title>Total DEX (Billions)</Title>
            <BarChart
              className="mt-6 h-72"
              data={data}
              index="date"
              categories={["total_dex"]}
              colors={["purple"]}
              yAxisWidth={48}
              valueFormatter={(number) => Intl.NumberFormat("en-US").format(number)}
            />
          </Card>

          <Card>
            <Title>Open Interest</Title>
            <LineChart
              className="mt-6 h-72"
              data={data}
              index="date"
              categories={["call_oi", "put_oi", "total_oi"]}
              colors={["emerald", "red", "amber"]}
              yAxisWidth={60}
              valueFormatter={(number) => Intl.NumberFormat("en-US").format(number)}
            />
          </Card>
        </>
      )}
    </div>
  );
}
