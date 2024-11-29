import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileDown, Loader2 } from 'lucide-react';
import { Student } from '../types';

// Pre-encoded base64 images
const KIHAP_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF0WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI2NWE3OWI0LCAyMDIyLzA2LzEzLTIyOjAxOjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjQuMCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjQtMDMtMjJUMTQ6NDc6NDctMDM6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDMtMjJUMTQ6NDc6NDctMDM6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI0LTAzLTIyVDE0OjQ3OjQ3LTAzOjAwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgc3RFdnQ6d2hlbj0iMjAyNC0wMy0yMlQxNDo0Nzo0Ny0wMzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI0LjAgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+";

const HYO_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF0WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI2NWE3OWI0LCAyMDIyLzA2LzEzLTIyOjAxOjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjQuMCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjQtMDMtMjJUMTQ6NDc6NDctMDM6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDMtMjJUMTQ6NDc6NDctMDM6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI0LTAzLTIyVDE0OjQ3OjQ3LTAzOjAwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjY5ZDM4YmM1LTVkNmUtNDI0ZC1hMzM0LTNmYmY1ZjY5ZjZhYyIgc3RFdnQ6d2hlbj0iMjAyNC0wMy0yMlQxNDo0Nzo0Ny0wMzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI0LjAgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+";

interface CertificateGeneratorProps {
  student: Student;
  onClose: () => void;
}

export default function CertificateGenerator({ student, onClose }: CertificateGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [certificateDate, setCertificateDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBelt, setSelectedBelt] = useState(student.belt);
  const [studentName, setStudentName] = useState(student.name);
  const [error, setError] = useState<string | null>(null);

  const generateCertificate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 297, 210, 'F');

      // Border with golden color (#dfa129)
      doc.setDrawColor(223, 161, 41); // #dfa129
      doc.setLineWidth(0.5);
      doc.rect(15, 15, 267, 180);
      doc.setLineWidth(0.1);
      doc.rect(17, 17, 263, 176);

      try {
        // Add KIHAP logo
        doc.addImage(
          KIHAP_LOGO,
          'PNG',
          30,
          30,
          60,
          20,
          undefined,
          'FAST'
        );

        // Add HYO logo
        doc.addImage(
          HYO_LOGO,
          'PNG',
          207,
          30,
          40,
          20,
          undefined,
          'FAST'
        );
      } catch (imgError) {
        console.error('Error adding logos:', imgError);
        // Continue without logos if they fail to load
      }

      // Certificate content
      doc.setTextColor(48, 48, 48);

      // Set fonts
      doc.setFont('helvetica', 'normal');

      // Title
      doc.setFontSize(36);
      doc.setFont('helvetica', 'bold');
      doc.text('Certificado de Graduação', 148.5, 100, { align: 'center' });

      // Certificate text
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      doc.text('Certificamos que', 148.5, 120, { align: 'center' });

      // Student name
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(studentName, 148.5, 130, { align: 'center' });

      // Belt information
      doc.setFontSize(16);
      doc.setFont('helvetica', 'normal');
      const beltText = 'foi aprovado(a) no exame de faixa e graduado(a) à graduação';
      doc.text(beltText, 148.5, 145, { align: 'center' });

      // Belt name
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(selectedBelt, 148.5, 155, { align: 'center' });

      // Date
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      const formattedDate = format(new Date(certificateDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      doc.text(formattedDate, 148.5, 180, { align: 'center' });

      // Save the PDF
      doc.save(`certificado_${studentName.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating certificate:', error);
      setError('Erro ao gerar o certificado. Por favor, tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            Gerar Certificado
          </h2>
        </div>

        <div className="p-6">
          <div className="space-y-4 mb-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-md">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Aluno
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Faixa
              </label>
              <input
                type="text"
                value={selectedBelt}
                onChange={(e) => setSelectedBelt(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Emissão
              </label>
              <input
                type="date"
                value={certificateDate}
                onChange={(e) => setCertificateDate(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#1d528d] focus:ring-1 focus:ring-[#1d528d]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isGenerating}
            >
              Cancelar
            </button>
            <button
              onClick={generateCertificate}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#303030] border border-transparent rounded-md hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileDown size={18} />
                  Gerar Certificado
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}