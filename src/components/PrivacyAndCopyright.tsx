import React from 'react';
import MainHeader from './MainHeader';
import Footer from './Footer';

export default function PrivacyAndCopyright() {
  return (
    <div className="min-h-screen bg-gray-100">
      <MainHeader />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">Política de Privacidade e Direitos Autorais</h1>
          
          <section className="bg-white rounded-lg shadow-md p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Política de Privacidade</h2>
            
            <div className="space-y-6 text-gray-600">
              <p>
                A KIHAP está comprometida com a proteção da sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações pessoais.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">1. Coleta de Dados</h3>
              <p>
                Coletamos informações que você nos fornece diretamente ao:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Cadastrar-se em nossa academia</li>
                <li>Solicitar informações sobre nossos serviços</li>
                <li>Interagir com nosso site ou aplicativos</li>
                <li>Participar de pesquisas ou promoções</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">2. Uso das Informações</h3>
              <p>
                Utilizamos suas informações para:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Fornecer e melhorar nossos serviços</li>
                <li>Comunicar-nos com você sobre aulas, eventos e promoções</li>
                <li>Processar pagamentos</li>
                <li>Personalizar sua experiência</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">3. Proteção de Dados</h3>
              <p>
                Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger suas informações pessoais contra processamento não autorizado ou ilegal, perda acidental, destruição ou danos.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">4. Seus Direitos</h3>
              <p>
                De acordo com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou imprecisos</li>
                <li>Solicitar a exclusão de seus dados</li>
                <li>Revogar o consentimento para processamento de dados</li>
                <li>Ser informado sobre o compartilhamento de seus dados</li>
              </ul>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Direitos Autorais</h2>
            
            <div className="space-y-6 text-gray-600">
              <p>
                Todo o conteúdo presente neste site, incluindo mas não limitado a textos, gráficos, logos, ícones, imagens, clipes de áudio, downloads digitais e compilações de dados, é de propriedade exclusiva da KIHAP ou de seus fornecedores de conteúdo e está protegido por leis brasileiras e internacionais de direitos autorais.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">1. Uso do Conteúdo</h3>
              <p>
                É expressamente proibido:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Copiar, modificar ou distribuir o conteúdo sem autorização prévia</li>
                <li>Usar o conteúdo para fins comerciais sem licença</li>
                <li>Remover avisos de direitos autorais ou marcas registradas</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">2. Marcas Registradas</h3>
              <p>
                KIHAP e todas as marcas relacionadas, logos e nomes comerciais são marcas registradas da KIHAP. O uso não autorizado dessas marcas é estritamente proibido.
              </p>

              <h3 className="text-xl font-semibold text-gray-800 mt-6">3. Licença Limitada</h3>
              <p>
                Concedemos a você uma licença limitada, não exclusiva e não transferível para acessar e fazer uso pessoal deste site. Esta licença não inclui:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Revenda ou uso comercial do site ou seu conteúdo</li>
                <li>Coleta e uso de listagens de produtos, descrições ou preços</li>
                <li>Uso derivado deste site ou seu conteúdo</li>
                <li>Download ou cópia de informações da conta</li>
              </ul>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}