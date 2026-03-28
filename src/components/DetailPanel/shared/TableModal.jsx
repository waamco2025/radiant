import { Backdrop, Modal, ModalHeader, ModalBody } from '../../modals/ModalShared'

export default function TableModal({ title, onClose, children }) {
  return (
    <Backdrop onClose={onClose}>
      <Modal width={900}>
        <ModalHeader title={title} onClose={onClose} />
        <ModalBody>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {children}
          </div>
        </ModalBody>
      </Modal>
    </Backdrop>
  )
}
